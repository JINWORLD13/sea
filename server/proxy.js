import express from "express";
import cors from "cors";
import { createServer } from "http";
import WebSocket, { WebSocketServer } from "ws";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../.env");
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const API_KEY =
  process.env.AISSTREAM_API_KEY || process.env.VITE_AISSTREAM_API_KEY;
const AIS_URL = process.env.AISSTREAM_URL || "wss://stream.aisstream.io/v0/stream";
const PORT = Number(process.env.PORT || process.env.PROXY_PORT || 8080);
const MAX_BOUNDING_BOXES = Number(process.env.AIS_MAX_BOUNDING_BOXES || 1);
const MAX_BOX_AREA = Number(process.env.AIS_MAX_BOUNDING_BOX_AREA || 0.25);
const MAX_MESSAGES_PER_SECOND = Number(
  process.env.AIS_MAX_MESSAGES_PER_SECOND || 180,
);
const MAX_TRACKED_MMSI = Number(process.env.AIS_MAX_TRACKED_MMSI || 600);
const CACHE_TTL_MS = Number(process.env.AIS_CACHE_TTL_MS || 10 * 60 * 1000);
const MAX_CACHE_ITEMS = Number(process.env.AIS_MAX_CACHE_ITEMS || 5000);
const SNAPSHOT_LIMIT = Number(process.env.AIS_SNAPSHOT_LIMIT || 300);
const UPSTREAM_MIN_BACKOFF_MS = Number(process.env.AIS_UPSTREAM_MIN_BACKOFF_MS || 1000);
const UPSTREAM_MAX_BACKOFF_MS = Number(process.env.AIS_UPSTREAM_MAX_BACKOFF_MS || 30000);

// 상시 구독(워밍업) 해역. 프런트엔드 regions와 동일하게 유지하여
// 클라이언트가 접속하기 전부터 캐시를 채워 즉시 스냅샷을 제공한다.
// Warm regions kept in sync with the frontend so the cache is always
// populated and a freshly connected client gets an instant snapshot.
// Format: [[minLat, minLng], [maxLat, maxLng]]
const WARM_REGION_BOXES = [
  [[34.95, 128.95], [35.2, 129.25]], // Busan
  [[37.3, 126.35], [37.62, 126.82]], // Incheon
  [[1.12, 103.55], [1.35, 104.15]], // Singapore Strait
];

if (!AIS_URL.startsWith("wss://")) {
  throw new Error("[Proxy] AIS_URL must use wss:// when using an API key.");
}

console.log(`[Proxy] API key loaded: ${API_KEY ? "yes" : "no"}`);

const app = express();
app.use(cors());

const server = createServer(app);
const wss = new WebSocketServer({ server });
const aisCache = new Map();
/** @type {Set<{socket: WebSocket, boxes: number[][][], seenMmsis: Set<string>, relayedThisSecond: number, droppedMessages: number}>} */
const clients = new Set();

// ---------------------------------------------------------------------------
// AIS 캐시 (단일 업스트림이 상시 채운다)
// AIS cache, continuously filled by a single shared upstream connection.
// ---------------------------------------------------------------------------

function extractPositionPayload(message) {
  if (!message || typeof message !== "object") return null;
  for (const candidate of Object.values(message)) {
    if (!candidate || typeof candidate !== "object") continue;
    if (
      typeof candidate.Latitude === "number" &&
      typeof candidate.Longitude === "number"
    ) {
      return candidate;
    }
  }
  return null;
}

function extractCacheEntry(dataText) {
  try {
    const parsed = JSON.parse(dataText);
    const mmsi = parsed?.MetaData?.MMSI;
    const payload = extractPositionPayload(parsed?.Message);
    if (!mmsi || !payload) return null;

    const lat = payload.Latitude;
    const lng = payload.Longitude;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return {
      mmsi: String(mmsi).trim(),
      lat,
      lng,
      lastSeen: Date.now(),
      dataText,
    };
  } catch {
    return null;
  }
}

function pruneAisCache() {
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [mmsi, entry] of aisCache.entries()) {
    if (entry.lastSeen < cutoff) {
      aisCache.delete(mmsi);
    }
  }

  if (aisCache.size <= MAX_CACHE_ITEMS) return;
  const oldestEntries = [...aisCache.values()].sort(
    (a, b) => a.lastSeen - b.lastSeen,
  );
  const deleteCount = aisCache.size - MAX_CACHE_ITEMS;
  for (let i = 0; i < deleteCount; i++) {
    aisCache.delete(oldestEntries[i].mmsi);
  }
}

function updateAisCache(dataText) {
  const entry = extractCacheEntry(dataText);
  if (!entry || !entry.mmsi) return null;
  aisCache.set(entry.mmsi, entry);
  return entry;
}

function isEntryInsideBoxes(entry, boxes) {
  return boxes.some((box) => {
    const minLat = box[0][0];
    const minLng = box[0][1];
    const maxLat = box[1][0];
    const maxLng = box[1][1];
    return (
      entry.lat >= minLat &&
      entry.lat <= maxLat &&
      entry.lng >= minLng &&
      entry.lng <= maxLng
    );
  });
}

// ---------------------------------------------------------------------------
// 클라이언트 요청 검증
// Client subscription validation
// ---------------------------------------------------------------------------

function sendClientError(clientSocket, error, message) {
  if (clientSocket.readyState !== WebSocket.OPEN) return;
  clientSocket.send(JSON.stringify({ error, message }));
}

function normalizeBoundingBoxes(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return {
      ok: false,
      error: "BOUNDING_BOX_REQUIRED",
      message: "BoundingBoxes must include one scoped operating area.",
    };
  }

  if (input.length > MAX_BOUNDING_BOXES) {
    return {
      ok: false,
      error: "TOO_MANY_BOUNDING_BOXES",
      message: `At most ${MAX_BOUNDING_BOXES} bounding box is allowed per subscription.`,
    };
  }

  const boxes = [];
  for (const box of input) {
    const sw = box?.[0];
    const ne = box?.[1];
    const values = [sw?.[0], sw?.[1], ne?.[0], ne?.[1]];
    if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      return {
        ok: false,
        error: "INVALID_BOUNDING_BOX",
        message: "BoundingBoxes must be [[minLat,minLng],[maxLat,maxLng]].",
      };
    }

    const minLat = Math.max(-90, Math.min(values[0], values[2]));
    const maxLat = Math.min(90, Math.max(values[0], values[2]));
    const minLng = Math.max(-180, Math.min(values[1], values[3]));
    const maxLng = Math.min(180, Math.max(values[1], values[3]));
    const area = Math.abs((maxLat - minLat) * (maxLng - minLng));

    if (area <= 0 || area > MAX_BOX_AREA) {
      return {
        ok: false,
        error: "BOUNDING_BOX_TOO_LARGE",
        message: `Bounding box area must be > 0 and <= ${MAX_BOX_AREA} square degrees.`,
      };
    }

    boxes.push([
      [minLat, minLng],
      [maxLat, maxLng],
    ]);
  }

  return { ok: true, boxes };
}

function sendCachedSnapshot(client) {
  if (client.socket.readyState !== WebSocket.OPEN) return 0;
  pruneAisCache();

  const snapshot = [...aisCache.values()]
    .filter((entry) => isEntryInsideBoxes(entry, client.boxes))
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, SNAPSHOT_LIMIT);

  for (const entry of snapshot) {
    client.socket.send(entry.dataText);
    client.seenMmsis.add(entry.mmsi);
  }

  return snapshot.length;
}

// ---------------------------------------------------------------------------
// 단일 상시 업스트림 (워밍업 + 자동 재연결)
// Single persistent upstream connection (warm-up + auto-reconnect).
// ---------------------------------------------------------------------------

let upstreamSocket = null;
let upstreamBackoff = UPSTREAM_MIN_BACKOFF_MS;
let upstreamReconnectTimer = null;
let upstreamConnectedSince = null;

function relayToClients(dataText, entry) {
  const mmsi = entry.mmsi;
  for (const client of clients) {
    if (client.socket.readyState !== WebSocket.OPEN) continue;
    if (client.boxes.length === 0) continue; // 아직 구독 전 / not subscribed yet
    if (!isEntryInsideBoxes(entry, client.boxes)) continue;

    if (mmsi && !client.seenMmsis.has(mmsi)) {
      if (client.seenMmsis.size >= MAX_TRACKED_MMSI) {
        client.droppedMessages += 1;
        continue;
      }
      client.seenMmsis.add(mmsi);
    }

    if (client.relayedThisSecond >= MAX_MESSAGES_PER_SECOND) {
      client.droppedMessages += 1;
      continue;
    }

    client.relayedThisSecond += 1;
    client.socket.send(dataText);
  }
}

function scheduleUpstreamReconnect() {
  if (upstreamReconnectTimer) return;
  const delay = upstreamBackoff;
  upstreamBackoff = Math.min(upstreamBackoff * 2, UPSTREAM_MAX_BACKOFF_MS);
  console.log(`[Proxy] Reconnecting upstream in ${delay}ms`);
  upstreamReconnectTimer = setTimeout(() => {
    upstreamReconnectTimer = null;
    connectUpstream();
  }, delay);
}

function connectUpstream() {
  if (!API_KEY) {
    console.warn("[Proxy] No API key; upstream will not connect.");
    return;
  }
  if (
    upstreamSocket &&
    (upstreamSocket.readyState === WebSocket.OPEN ||
      upstreamSocket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const socket = new WebSocket(AIS_URL);
  upstreamSocket = socket;

  socket.on("open", () => {
    upstreamBackoff = UPSTREAM_MIN_BACKOFF_MS;
    upstreamConnectedSince = Date.now();
    socket.send(
      JSON.stringify({
        APIkey: API_KEY,
        BoundingBoxes: WARM_REGION_BOXES,
      }),
    );
    console.log("[Proxy] Upstream connected, warming", {
      regions: WARM_REGION_BOXES.length,
    });
  });

  socket.on("message", (eventData) => {
    const dataText = eventData.toString();

    // 업스트림 에러 메시지는 캐시/릴레이 대상이 아니다.
    // Upstream-level errors are not position reports.
    if (dataText.includes('"error"') && !dataText.includes('"MetaData"')) {
      console.error("[Proxy] Upstream message error:", dataText.slice(0, 200));
      return;
    }

    const entry = updateAisCache(dataText);
    if (!entry) return; // 위치 보고가 아니면 캐시/릴레이 안 함 (대역폭 절약).
    pruneAisCache();
    relayToClients(dataText, entry);
  });

  socket.on("error", (err) => {
    console.error("[Proxy] Upstream error:", err.message || err);
  });

  socket.on("close", (code, reason) => {
    if (upstreamSocket === socket) {
      upstreamSocket = null;
      upstreamConnectedSince = null;
    }
    console.log("[Proxy] Upstream closed:", {
      code,
      reason: reason?.toString(),
      cacheSize: aisCache.size,
    });
    scheduleUpstreamReconnect();
  });
}

// 초당 릴레이 카운터 리셋 (전 클라이언트 공통)
// Reset per-client per-second relay counters.
const globalRateTimer = setInterval(() => {
  for (const client of clients) {
    client.relayedThisSecond = 0;
  }
}, 1000);

// ---------------------------------------------------------------------------
// 클라이언트 연결
// Client connection handling
// ---------------------------------------------------------------------------

wss.on("connection", (clientSocket) => {
  console.log("[Proxy] Browser connected");

  const client = {
    socket: clientSocket,
    boxes: [],
    seenMmsis: new Set(),
    relayedThisSecond: 0,
    droppedMessages: 0,
  };
  clients.add(client);

  // 클라이언트 접속 시 업스트림이 죽어 있으면 즉시 깨운다.
  // Wake the upstream immediately if it is down when a client arrives.
  if (!upstreamSocket) connectUpstream();

  clientSocket.on("message", (data) => {
    let clientRequest;
    try {
      clientRequest = JSON.parse(data.toString());
    } catch {
      sendClientError(
        clientSocket,
        "INVALID_REQUEST",
        "Subscription request must be valid JSON.",
      );
      return;
    }

    if (!API_KEY) {
      sendClientError(
        clientSocket,
        "API_KEY_MISSING",
        "AISSTREAM_API_KEY is missing in .env.",
      );
      return;
    }

    const boundsResult = normalizeBoundingBoxes(clientRequest.BoundingBoxes);
    if (!boundsResult.ok) {
      sendClientError(clientSocket, boundsResult.error, boundsResult.message);
      return;
    }

    // 새 구독 영역 적용 후 즉시 캐시 스냅샷 전송 (즉시 화면 채움).
    // Apply new area then immediately push a cached snapshot (instant fill).
    client.boxes = boundsResult.boxes;
    client.seenMmsis = new Set();
    client.droppedMessages = 0;

    const snapshotCount = sendCachedSnapshot(client);
    console.log("[Proxy] Client subscribed:", {
      firstBox: boundsResult.boxes[0],
      cachedSnapshot: snapshotCount,
      cacheSize: aisCache.size,
    });
  });

  clientSocket.on("close", () => {
    clients.delete(client);
    console.log("[Proxy] Browser connection closed", {
      remainingClients: clients.size,
    });
  });

  clientSocket.on("error", () => {
    clients.delete(client);
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    upstream: "aisstream",
    apiKeyConfigured: Boolean(API_KEY),
    upstreamConnected: Boolean(
      upstreamSocket && upstreamSocket.readyState === WebSocket.OPEN,
    ),
    upstreamUptimeMs: upstreamConnectedSince
      ? Date.now() - upstreamConnectedSince
      : 0,
    clients: clients.size,
    cacheSize: aisCache.size,
    limits: {
      maxBoundingBoxes: MAX_BOUNDING_BOXES,
      maxBoxArea: MAX_BOX_AREA,
      maxMessagesPerSecond: MAX_MESSAGES_PER_SECOND,
      maxTrackedMmsi: MAX_TRACKED_MMSI,
      cacheTtlMs: CACHE_TTL_MS,
      snapshotLimit: SNAPSHOT_LIMIT,
    },
  });
});

server.listen(PORT, () => {
  console.log(`[Proxy] AIS proxy listening on port ${PORT}`);
  // 서버 기동 즉시 워밍업 시작 → 첫 클라이언트도 즉시 스냅샷 수신.
  // Start warming immediately on boot so the first client gets data instantly.
  connectUpstream();
});

function shutdown() {
  console.log("[Proxy] Shutting down...");
  clearInterval(globalRateTimer);
  if (upstreamReconnectTimer) clearTimeout(upstreamReconnectTimer);
  if (upstreamSocket) upstreamSocket.terminate();
  wss.clients.forEach((client) => client.terminate());
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(0), 1000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
