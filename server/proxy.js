// express, cors, http, ws, dotenv 등 의존성 임포트
// express、cors、http、ws、dotenv などの依存関係をインポート
// Import dependencies: express, cors, http, ws, dotenv, etc.
import express from "express";
import cors from "cors";
import { createServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ES 모듈에서 __dirname 사용하기 위함
// ESモジュールで __dirname を使うため
// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 로드
// .env ファイルを読み込む
// Load .env file
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const API_KEY = process.env.VITE_AISSTREAM_API_KEY;
console.log(
  `[Proxy] API Key loaded: ${API_KEY ? "Yes (starts with " + API_KEY.substring(0, 5) + "...)" : "No"}`,
);

// AIS 스트림 URL 및 서버 포트 (API 키 전송은 반드시 WSS/HTTPS만 사용)
// AISストリームURLとサーバーポート（APIキー送信は必ずWSS/HTTPSのみ）
// AIS stream URL and server port (API key must only be sent over WSS/HTTPS)
const AIS_URL = "wss://stream.aisstream.io/v0/stream";
if (!AIS_URL.startsWith("wss://")) {
  throw new Error("[Proxy] Security: AIS_URL must use wss:// when using API key.");
}
const PORT = 8080;

// Express 앱 및 HTTP 서버 생성 (CORS 적용)
// ExpressアプリとHTTPサーバーを作成（CORS有効）
// Create Express app and HTTP server with CORS enabled
const app = express();
app.use(cors());

const server = createServer(app);
const wss = new WebSocketServer({ server });

console.log(
  `[Proxy] AIS proxy server listening on port ${PORT} (CORS enabled)...`,
);

// 브라우저(클라이언트) WebSocket 연결 처리
// ブラウザ（クライアント）WebSocket接続の処理
// Handle browser (client) WebSocket connection
wss.on("connection", (clientSocket) => {
  console.log("[Proxy] Browser connected");

  let aisSocket = null;
  // 클라이언트 끊김 시 AIS 소켓을 400ms 지연 후 닫기 위한 타이머 (순간 끊김/재연결 대비)
  // クライアント切断時にAISソケットを400ms遅延後に閉じるためのタイマー（瞬間切断・再接続対策）
  // Timer to close AIS socket 400ms after client disconnect (handles brief disconnects/reconnect)
  let closeTimer = null;

  // 브라우저에서 메시지(구독 요청)를 받으면 AIS 서버와 연결 시작
  // ブラウザからメッセージ（購読リクエスト）を受信したらAISサーバーに接続開始
  // When message (subscription request) received from browser, start connection to AIS server
  clientSocket.on("message", (data) => {
    try {
      const clientRequest = JSON.parse(data.toString());
      if (!API_KEY) {
        console.error("[Proxy] AISStream API key missing");
        return;
      }
      // 기존 AIS 소켓은 새 연결이 열린 뒤 onopen에서 닫음 (즉시 닫으면 1006 발생)
      // 既存のAISソケットは新接続のonopen後に閉じる（即時closeで1006が出るため）
      // Close existing AIS socket in new socket's onopen, not here (avoids 1006)

      const subRequest = {
        APIkey: API_KEY,
        BoundingBoxes: clientRequest.BoundingBoxes || [],
      };

      // 새 구독 요청 시 예약된 closeTimer가 있으면 취소 (AIS 소켓을 닫지 않음)
      // 新規購読リクエスト時に予約されたcloseTimerがあればキャンセル（AISソケットを閉じない）
      // Cancel scheduled closeTimer on new subscription so we don't close AIS socket
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }

      // 새 연결을 먼저 열고, 열린 뒤에만 이전 연결을 닫음 (연결 전 닫기로 인한 1006 방지)
      // 新接続を先に開き、開いた後にのみ前の接続を閉じる（接続前に閉じると1006が出るため）
      // Open new connection first; close previous only after new one is open
      const previousAisSocket = aisSocket;
      console.log("[Proxy] Connecting to AISStream...");
      aisSocket = new WebSocket(AIS_URL);

      // 업스트림 연결 성공 시 구독 메시지 전송(전 소켓을 먼저 닫고 나서 새 소켓에 구독을 보내면, 그 사이에 어느 쪽에서도 데이터를 받지 못하는 짧은 공백이 생깁니다.지금처럼 새 소켓에 구독 먼저 → 이전 소켓 닫기 순서가 데이터 끊김을 줄이는 맞는 순서)
      // アップストリーム接続成功時に購読メッセージを送信
      // On upstream connection success, send subscription message
      aisSocket.onopen = () => {
        aisSocket.send(JSON.stringify(subRequest));
        if (previousAisSocket) {
          previousAisSocket.close();
        }
      };

      // AIS에서 받은 데이터를 브라우저로 중계
      // AISから受信したデータをブラウザへ中継
      // Relay data received from AIS to browser
      aisSocket.onmessage = (event) => {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }
      };

      // AISStream 업스트림 에러 처리
      // AISStreamアップストリームエラー処理
      // AISStream upstream error handling
      aisSocket.onerror = (err) => {
        console.error("[Proxy] AISStream error:", err.message || err);
      };

      // AISStream 연결 종료 시 로그
      // AISStream接続終了時のログ
      // Log when AISStream connection closes
      aisSocket.onclose = (event) => {
        console.log("[Proxy] AISStream closed:", event.code, event.reason);
      };
    } catch (err) {
      console.error("[Proxy] Fatal error processing browser message:", err);
    }
  });

  // 클라이언트 연결 종료 시 AIS 소켓도 정리
  // クライアント接続終了時にAISソケットもクリーンアップ
  // Clean up AIS socket when client connection closes
  clientSocket.on("close", () => {
    console.log("[Proxy] Browser connection closed");
    if (closeTimer) clearTimeout(closeTimer);
    // 400ms 후에 AIS 업스트림 닫기 (즉시 닫지 않음 → 순간 끊김/재연결 시 불필요한 재연결 방지)
    // 400ms後にAISアップストリームを閉じる（即時閉じない→瞬間切断・再接続時の不要な再接続を防止）
    // Close AIS upstream after 400ms (delay avoids unnecessary reconnect on brief disconnect)
    closeTimer = setTimeout(() => {
      if (aisSocket) aisSocket.close();
      closeTimer = null;
    }, 400);
  });
});

// HTTP 서버 포트 리스닝 시작
// HTTPサーバーのポートリスニング開始
// Start HTTP server listening on port
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// 종료 시그널 처리: npm run dev 중단 시 포트 해제
// 終了シグナル処理: npm run dev 停止時にポート解放
// Graceful shutdown so port 8080 is released when dev stops
function shutdown() {
  console.log("[Proxy] Shutting down...");
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
