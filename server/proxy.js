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

// VITE_ 접두사 변수는 의도적으로 읽지 않는다 — 그 이름이 프런트 번들에
// 복사되는 사고를 코드 레벨에서 차단하기 위함이다 (.env.example 참고).
// Deliberately no VITE_-prefixed fallback: accepting that name here invites
// copying it into the client bundle. See .env.example.
const API_KEY = process.env.AISSTREAM_API_KEY;
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
const SNAPSHOT_CHUNK_SIZE = 100; // WireSnapshot chunk 크기 (계약 고정) / contract-fixed chunk size
const UPSTREAM_MIN_BACKOFF_MS = Number(process.env.AIS_UPSTREAM_MIN_BACKOFF_MS || 1000);
const UPSTREAM_MAX_BACKOFF_MS = Number(process.env.AIS_UPSTREAM_MAX_BACKOFF_MS || 30000);
const MAX_CLIENTS = Number(process.env.AIS_MAX_CLIENTS || 20);
const MAX_UPSTREAM_BOXES = Number(process.env.AIS_MAX_UPSTREAM_BOXES || 8);
const RESUBSCRIBE_DEBOUNCE_MS = 2000;
// 클라이언트 구독 메시지 최소 간격. 프런트는 400ms 디바운스로 보내므로
// 정상 클라이언트는 걸리지 않고, 플러드만 조용히 무시된다.
// Minimum interval between subscription messages per client. The frontend
// debounces at 400ms, so only floods are (silently) ignored.
const MIN_SUBSCRIBE_INTERVAL_MS = 300;
// 클라이언트 → 프록시 메시지는 구독 요청뿐이므로 크게 잡을 이유가 없다
// (ws 기본값 100MB는 OOM 벡터가 된다).
// Client messages are tiny subscription payloads; the ws default of 100MB
// is an OOM vector, so cap frames hard.
const MAX_CLIENT_PAYLOAD_BYTES = 64 * 1024;
const WATCHDOG_INTERVAL_MS = 30 * 1000;
const UPSTREAM_STALE_MS = 90 * 1000;
const CACHE_PRUNE_INTERVAL_MS = 30 * 1000;
const SEEN_MMSI_TTL_MS = 10 * 60 * 1000;
const SEEN_MMSI_PRUNE_INTERVAL_MS = 60 * 1000;
const SEARCH_DEFAULT_LIMIT = 20;
const SEARCH_MAX_LIMIT = 50;

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

// 허용 Origin 목록(쉼표 구분). 비워두면 모든 Origin 허용(로컬 개발 기본값).
// 배포 시 ALLOWED_ORIGINS=https://your-app.vercel.app 형태로 잠근다.
// Comma-separated Origin allowlist. Empty = allow all (local-dev default);
// set ALLOWED_ORIGINS=https://your-app.vercel.app in production to lock down.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(
  cors(ALLOWED_ORIGINS.length > 0 ? { origin: ALLOWED_ORIGINS } : undefined),
);

const server = createServer(app);
const wss = new WebSocketServer({
  server,
  maxPayload: MAX_CLIENT_PAYLOAD_BYTES,
});
wss.on("error", (err) => {
  console.error("[Proxy] WebSocket server error:", err?.message || err);
});

/**
 * @typedef {{ month: number, day: number, hour: number, minute: number }} EtaFields
 * @typedef {{
 *   name: string | null,
 *   imo: string | null,
 *   callsign: string | null,
 *   type: number | null,
 *   dest: string | null,
 *   eta: EtaFields | null,
 *   length: number | null,
 *   width: number | null,
 *   draught: number | null,
 * }} StaticInfo
 * @typedef {{
 *   mmsi: string,
 *   lat: number | null,
 *   lng: number | null,
 *   sog: number | null,
 *   cog: number | null,
 *   hdg: number | null,
 *   nav: number | null,
 *   name: string | null,
 *   kind: "vessel" | "aton" | "base",
 *   ts: number,
 *   static: StaticInfo | null,
 *   staticTs: number,
 * }} CacheEntry
 * @typedef {{
 *   socket: WebSocket,
 *   boxes: number[][][],
 *   subscribedAt: number,
 *   lastSubscribeAt: number,
 *   seenMmsis: Map<string, number>,
 *   relayedThisSecond: number,
 *   isAlive: boolean,
 * }} ProxyClient
 */

/** @type {Map<string, CacheEntry>} */
const aisCache = new Map();
/** @type {Set<ProxyClient>} */
const clients = new Set();

// ---------------------------------------------------------------------------
// AIS 필드 정규화 (AIS 센티널 값을 서버에서 null 로 변환)
// AIS field normalization — sentinel values become null on the server side so
// clients never have to know about 511 / 102.3 / 360 magic numbers.
// ---------------------------------------------------------------------------

/** SOG(노트). 102.3 이상은 "정보 없음" 센티널. / knots; >=102.3 means unavailable. */
function normalizeSog(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 102.3
    ? value
    : null;
}

/** COG 0..359.9. 360 이상은 "정보 없음". / 0..359.9; >=360 means unavailable. */
function normalizeCog(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 360
    ? value
    : null;
}

/** TrueHeading 0..359. 511은 "정보 없음". / 0..359; 511 means unavailable. */
function normalizeHeading(value) {
  return Number.isInteger(value) && value >= 0 && value <= 359 ? value : null;
}

/** NavigationalStatus 0..15, 그 외/부재 시 null. / 0..15, null when absent. */
function normalizeNavStatus(value) {
  return Number.isInteger(value) && value >= 0 && value <= 15 ? value : null;
}

/**
 * AIS 6비트 문자열 정리: '@' 패딩 제거 + 공백 정리, 빈 문자열은 null.
 * Clean AIS 6-bit text: strip '@' padding, collapse whitespace, blank -> null.
 */
function cleanAisText(value) {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/@/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** IMO 번호: 0/부재는 null, 그 외 문자열화. / 0/absent -> null, else stringified. */
function normalizeImo(value) {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) && num > 0
    ? String(Math.trunc(num))
    : null;
}

/** AIS 선종 코드 1..99 (0 = "정보 없음"). / ship type code, 0 means unavailable. */
function normalizeShipType(value) {
  return Number.isInteger(value) && value >= 1 && value <= 99 ? value : null;
}

/** Dimension.A + Dimension.B → 전장. 0이면 null. / overall length; 0 -> null. */
function lengthFromDimension(dim) {
  if (!dim || typeof dim !== "object") return null;
  const a = Number(dim.A);
  const b = Number(dim.B);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const total = a + b;
  return total > 0 ? total : null;
}

/** Dimension.C + Dimension.D → 선폭. 0이면 null. / beam; 0 -> null. */
function widthFromDimension(dim) {
  if (!dim || typeof dim !== "object") return null;
  const c = Number(dim.C);
  const d = Number(dim.D);
  if (!Number.isFinite(c) || !Number.isFinite(d)) return null;
  const total = c + d;
  return total > 0 ? total : null;
}

/** 최대 흘수(m). 0이면 null. / maximum static draught in metres; 0 -> null. */
function normalizeDraught(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * ETA 필드 검증: 네 필드가 모두 유효 범위일 때만 전달, 아니면 null.
 * (AIS 기본값 00-00 24:60 = "정보 없음")
 * ETA is only forwarded when all four fields are in valid ranges; the AIS
 * default 00-00 24:60 means "not available" and becomes null.
 */
function normalizeEta(raw) {
  if (!raw || typeof raw !== "object") return null;
  const month = Number(raw.Month);
  const day = Number(raw.Day);
  const hour = Number(raw.Hour);
  const minute = Number(raw.Minute);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { month, day, hour, minute };
}

/**
 * MMSI 위생 규칙: MessageType 분류 위에 MMSI 접두사 규칙을 덧씌운다.
 * 9자리 "00" 시작 → 기지국(base), "99" 시작 → 항로표지(aton).
 * MMSI hygiene: on top of MessageType classification, 9-digit MMSIs starting
 * with "00" are base stations and "99" are aids to navigation.
 */
function classifyKindByMmsi(mmsi, fallbackKind) {
  if (/^00\d{7}$/.test(mmsi)) return "base";
  if (/^99\d{7}$/.test(mmsi)) return "aton";
  return fallbackKind;
}

// ---------------------------------------------------------------------------
// AIS 캐시 (단일 업스트림이 상시 채운다)
// AIS cache, continuously filled by a single shared upstream connection.
// ---------------------------------------------------------------------------

/** @returns {CacheEntry} */
function createCacheEntry(mmsi) {
  return {
    mmsi,
    lat: null,
    lng: null,
    sog: null,
    cog: null,
    hdg: null,
    nav: null,
    name: null,
    kind: classifyKindByMmsi(mmsi, "vessel"),
    ts: 0,
    static: null,
    staticTs: 0,
  };
}

function entryHasPosition(entry) {
  return typeof entry.lat === "number" && typeof entry.lng === "number";
}

function entryLastActivity(entry) {
  return Math.max(entry.ts || 0, entry.staticTs || 0);
}

function entryDisplayName(entry) {
  return entry.static?.name ?? entry.name;
}

/**
 * TTL 초과/용량 초과 항목 제거. 핫패스에서 빠져 30초 주기 타이머로만 실행된다.
 * Evict expired / excess entries. Runs on a 30s interval only — never on the
 * per-message hot path.
 */
function pruneAisCache() {
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [mmsi, entry] of aisCache.entries()) {
    if (entryLastActivity(entry) < cutoff) {
      aisCache.delete(mmsi);
    }
  }

  if (aisCache.size <= MAX_CACHE_ITEMS) return;
  const oldestEntries = [...aisCache.values()].sort(
    (a, b) => entryLastActivity(a) - entryLastActivity(b),
  );
  const deleteCount = aisCache.size - MAX_CACHE_ITEMS;
  for (let i = 0; i < deleteCount; i++) {
    aisCache.delete(oldestEntries[i].mmsi);
  }
}

function isPointInsideBoxes(lat, lng, boxes) {
  return boxes.some((box) => {
    const minLat = box[0][0];
    const minLng = box[0][1];
    const maxLat = box[1][0];
    const maxLng = box[1][1];
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
  });
}

// ---------------------------------------------------------------------------
// 업스트림 메시지 파싱 (MessageType 기준) → 정규화된 와이어 메시지 릴레이
// Upstream parsing keyed on MessageType → normalized wire-message relay.
// ---------------------------------------------------------------------------

/**
 * 위치 보고 MessageType → kind 매핑. aisstream 표기 변형까지 함께 수용한다.
 * Position-report MessageType → kind. Accepts both aisstream spellings of the
 * Class-B report names for robustness.
 */
const POSITION_MESSAGE_KINDS = {
  PositionReport: "vessel",
  StandardClassBPositionReport: "vessel",
  StandardClassBCSPositionReport: "vessel",
  ExtendedClassBPositionReport: "vessel",
  ExtendedClassBCSPositionReport: "vessel",
  AidsToNavigationReport: "aton",
  BaseStationReport: "base",
};

const STATIC_MESSAGE_TYPES = new Set(["ShipStaticData", "StaticDataReport"]);

/** Message[MessageType] 우선, 없으면 첫 객체 값으로 폴백. / direct key, then fallback scan. */
function extractMessagePayload(parsed, messageType) {
  const message = parsed?.Message;
  if (!message || typeof message !== "object") return null;
  const direct = message[messageType];
  if (direct && typeof direct === "object") return direct;
  for (const candidate of Object.values(message)) {
    if (candidate && typeof candidate === "object") return candidate;
  }
  return null;
}

/**
 * 위치 보고 처리: 캐시 갱신 후 WirePos 를 해당 해역 클라이언트에 릴레이.
 * Handle a position report: update the cache, then relay a WirePos to every
 * client whose subscribed box contains it.
 */
function handlePositionMessage(mmsi, kindFromType, payload, metaName, now) {
  const lat = payload.Latitude;
  const lng = payload.Longitude;
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return; // AIS "위치 없음" 센티널(91/181) 포함 무효 좌표 / invalid coords incl. 91/181 sentinels
  }

  let entry = aisCache.get(mmsi);
  if (!entry) {
    entry = createCacheEntry(mmsi);
    aisCache.set(mmsi, entry);
  }

  entry.lat = lat;
  entry.lng = lng;
  entry.sog = normalizeSog(payload.Sog);
  entry.cog = normalizeCog(payload.Cog);
  entry.hdg = normalizeHeading(payload.TrueHeading);
  entry.nav = normalizeNavStatus(payload.NavigationalStatus);
  entry.kind = classifyKindByMmsi(mmsi, kindFromType);
  entry.ts = now;

  // 이름은 MetaData 우선, AtoN/확장 Class-B 페이로드의 Name 을 폴백으로 사용.
  // Name from MetaData first, falling back to the payload Name field carried
  // by AtoN and extended Class-B reports.
  const payloadName = cleanAisText(payload.Name);
  if (metaName ?? payloadName) entry.name = metaName ?? payloadName;

  const wireText = JSON.stringify({
    t: "pos",
    mmsi,
    lat,
    lng,
    sog: entry.sog,
    cog: entry.cog,
    hdg: entry.hdg,
    nav: entry.nav,
    name: entryDisplayName(entry),
    kind: entry.kind,
    ts: now,
  });
  relayToClients(wireText, lat, lng, mmsi, now);
}

/** ShipStaticData → 정적 필드 패치. / full static/voyage patch. */
function staticPatchFromShipStaticData(payload) {
  return {
    name: cleanAisText(payload.Name),
    imo: normalizeImo(payload.ImoNumber),
    callsign: cleanAisText(payload.CallSign),
    type: normalizeShipType(payload.Type),
    dest: cleanAisText(payload.Destination),
    eta: normalizeEta(payload.Eta),
    length: lengthFromDimension(payload.Dimension),
    width: widthFromDimension(payload.Dimension),
    draught: normalizeDraught(payload.MaximumStaticDraught),
  };
}

/** StaticDataReport Part A(이름) / Part B(선종·호출부호·치수) 패치. */
function staticPatchFromStaticDataReport(payload) {
  const patch = {};
  const partA = payload.ReportA;
  if (partA && typeof partA === "object" && partA.Valid !== false) {
    patch.name = cleanAisText(partA.Name);
  }
  const partB = payload.ReportB;
  if (partB && typeof partB === "object" && partB.Valid !== false) {
    patch.callsign = cleanAisText(partB.CallSign);
    patch.type = normalizeShipType(partB.ShipType);
    patch.length = lengthFromDimension(partB.Dimension);
    patch.width = widthFromDimension(partB.Dimension);
  }
  return patch;
}

/**
 * 정적 데이터 병합: null(정보 없음)로 기존 값을 지우지 않는다.
 * Merge static fields; null ("unavailable") never erases a known value.
 * @returns {boolean} 병합으로 실제 반영된 필드가 있으면 true / true when any field applied
 */
function mergeStaticPatch(entry, patch, now) {
  if (!entry.static) {
    entry.static = {
      name: null,
      imo: null,
      callsign: null,
      type: null,
      dest: null,
      eta: null,
      length: null,
      width: null,
      draught: null,
    };
  }
  let applied = false;
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) continue;
    entry.static[key] = value;
    applied = true;
  }
  if (applied) entry.staticTs = now;
  return applied;
}

/**
 * 정적 보고 처리: 위치가 아직 없어도 캐시에 담아두고(위치가 나중에 올 수 있음),
 * 마지막 위치가 구독 박스 안에 있는 클라이언트에게만 WireStatic 을 릴레이한다.
 * Handle a static report: cache even without a position (one may arrive
 * later); relay a WireStatic only to clients whose boxes contain the ship's
 * last-known position.
 */
function handleStaticMessage(mmsi, messageType, payload, metaName, now) {
  let entry = aisCache.get(mmsi);
  if (!entry) {
    entry = createCacheEntry(mmsi);
    aisCache.set(mmsi, entry);
  }
  if (metaName) entry.name = metaName;

  const patch =
    messageType === "ShipStaticData"
      ? staticPatchFromShipStaticData(payload)
      : staticPatchFromStaticDataReport(payload);
  const applied = mergeStaticPatch(entry, patch, now);
  if (!applied) return; // 전 필드가 "정보 없음"이면 릴레이 생략 / all-sentinel report, nothing to relay
  if (!entryHasPosition(entry)) return; // 위치를 모르면 매칭 불가 / no position known yet

  const s = entry.static;
  const wireText = JSON.stringify({
    t: "static",
    mmsi,
    name: s.name ?? entry.name,
    imo: s.imo,
    callsign: s.callsign,
    type: s.type,
    dest: s.dest,
    eta: s.eta,
    length: s.length,
    width: s.width,
    draught: s.draught,
    ts: now,
  });
  relayToClients(wireText, entry.lat, entry.lng, mmsi, now);
}

function handleUpstreamMessage(parsed, now) {
  const messageType = parsed?.MessageType;
  if (typeof messageType !== "string") return;

  const mmsiRaw = parsed?.MetaData?.MMSI;
  if (mmsiRaw === undefined || mmsiRaw === null) return;
  const mmsi = String(mmsiRaw).trim();
  if (!mmsi) return;
  const metaName = cleanAisText(parsed?.MetaData?.ShipName);

  if (STATIC_MESSAGE_TYPES.has(messageType)) {
    const payload = extractMessagePayload(parsed, messageType);
    if (!payload) return;
    handleStaticMessage(mmsi, messageType, payload, metaName, now);
    return;
  }

  const kind = POSITION_MESSAGE_KINDS[messageType];
  if (!kind) return; // 관리용/기타 메시지 타입은 무시 / administrative message types ignored

  const payload = extractMessagePayload(parsed, messageType);
  if (!payload) return;
  handlePositionMessage(mmsi, kind, payload, metaName, now);
}

// ---------------------------------------------------------------------------
// 클라이언트 릴레이 (추적 상한 + 초당 릴레이 상한)
// Relay to clients with per-client tracked-MMSI and per-second rate caps.
// ---------------------------------------------------------------------------

function safeSend(socket, text) {
  if (socket.readyState !== WebSocket.OPEN) return false;
  try {
    socket.send(text);
    return true;
  } catch {
    return false;
  }
}

function relayToClients(wireText, lat, lng, mmsi, now) {
  for (const client of clients) {
    if (client.socket.readyState !== WebSocket.OPEN) continue;
    if (client.boxes.length === 0) continue; // 아직 구독 전 / not subscribed yet
    if (!isPointInsideBoxes(lat, lng, client.boxes)) continue;

    if (!client.seenMmsis.has(mmsi) && client.seenMmsis.size >= MAX_TRACKED_MMSI) {
      continue;
    }
    if (client.relayedThisSecond >= MAX_MESSAGES_PER_SECOND) {
      continue;
    }

    if (safeSend(client.socket, wireText)) {
      client.relayedThisSecond += 1;
      client.seenMmsis.set(mmsi, now);
    }
  }
}

/**
 * seenMmsis 는 릴레이 시각 기준 10분 TTL — 오래 접속한 클라이언트도
 * 새로 나타난 선박을 계속 받을 수 있도록 주기적으로 비운다.
 * Per-client seen-MMSI entries expire 10 minutes after the last relay, so
 * long-lived clients keep receiving newly appearing vessels.
 */
function pruneSeenMmsis() {
  const cutoff = Date.now() - SEEN_MMSI_TTL_MS;
  for (const client of clients) {
    for (const [mmsi, lastRelayedAt] of client.seenMmsis.entries()) {
      if (lastRelayedAt < cutoff) client.seenMmsis.delete(mmsi);
    }
  }
}

// ---------------------------------------------------------------------------
// 클라이언트 요청 검증
// Client subscription validation
// ---------------------------------------------------------------------------

function sendClientError(clientSocket, error, message) {
  safeSend(clientSocket, JSON.stringify({ t: "error", error, message }));
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

    // 범위 밖 좌표는 클램프하지 않고 거부한다. 클램프하면 lat=200 같은 값이
    // 뒤집힌 박스로 살아남아 그대로 업스트림에 전달될 수 있다.
    // Reject out-of-range coordinates instead of clamping — clamping lets a
    // value like lat=200 survive as an inverted box and reach the upstream.
    const [lat1, lng1, lat2, lng2] = values;
    if (
      Math.abs(lat1) > 90 ||
      Math.abs(lat2) > 90 ||
      Math.abs(lng1) > 180 ||
      Math.abs(lng2) > 180
    ) {
      return {
        ok: false,
        error: "INVALID_BOUNDING_BOX",
        message:
          "Latitudes must be within [-90, 90] and longitudes within [-180, 180].",
      };
    }

    const minLat = Math.min(lat1, lat2);
    const maxLat = Math.max(lat1, lat2);
    const minLng = Math.min(lng1, lng2);
    const maxLng = Math.max(lng1, lng2);
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

// ---------------------------------------------------------------------------
// 스냅샷 (청크 전송: 메시지당 최대 100척 + snapshotEnd)
// Cached snapshot, chunked at <=100 ships per message, then snapshotEnd.
// ---------------------------------------------------------------------------

/** 캐시 항목 → WireSnapshotEntry (위치+정적 병합 평탄화). / merged, flattened. */
function toSnapshotEntry(entry) {
  const s = entry.static;
  return {
    mmsi: entry.mmsi,
    lat: entry.lat,
    lng: entry.lng,
    sog: entry.sog,
    cog: entry.cog,
    hdg: entry.hdg,
    nav: entry.nav,
    name: entryDisplayName(entry),
    kind: entry.kind,
    ts: entry.ts,
    type: s?.type ?? null,
    dest: s?.dest ?? null,
    eta: s?.eta ?? null,
    length: s?.length ?? null,
    width: s?.width ?? null,
    draught: s?.draught ?? null,
    imo: s?.imo ?? null,
    callsign: s?.callsign ?? null,
  };
}

function sendCachedSnapshot(client) {
  if (client.socket.readyState !== WebSocket.OPEN) return 0;
  const now = Date.now();

  // 위치가 있는 항목만 스냅샷 대상 (정적 데이터만 아는 선박 제외).
  // Only entries with a known position qualify for the snapshot.
  const entries = [...aisCache.values()]
    .filter(
      (entry) =>
        entryHasPosition(entry) &&
        isPointInsideBoxes(entry.lat, entry.lng, client.boxes),
    )
    .sort((a, b) => b.ts - a.ts)
    .slice(0, SNAPSHOT_LIMIT);

  for (let i = 0; i < entries.length; i += SNAPSHOT_CHUNK_SIZE) {
    const ships = entries.slice(i, i + SNAPSHOT_CHUNK_SIZE).map(toSnapshotEntry);
    if (!safeSend(client.socket, JSON.stringify({ t: "snapshot", ships }))) {
      return 0;
    }
  }
  safeSend(client.socket, JSON.stringify({ t: "snapshotEnd", total: entries.length }));

  for (const entry of entries) {
    client.seenMmsis.set(entry.mmsi, now);
  }
  return entries.length;
}

// ---------------------------------------------------------------------------
// 동적 업스트림 구독: 워밍업 해역 ∪ 클라이언트 박스 (최대 8개, 2초 디바운스)
// Dynamic upstream subscription: warm regions ∪ unique client boxes, capped at
// 8 boxes total, re-sent on the same socket debounced by 2 seconds.
// ---------------------------------------------------------------------------

let currentUpstreamBoxes = WARM_REGION_BOXES;
let resubscribeTimer = null;

function boxKey(box) {
  return `${box[0][0].toFixed(4)},${box[0][1].toFixed(4)},${box[1][0].toFixed(4)},${box[1][1].toFixed(4)}`;
}

function boxSetKey(boxes) {
  return boxes.map(boxKey).sort().join("|");
}

/**
 * 유효 박스 집합 계산: 워밍업 해역은 항상 포함, 남는 슬롯은 최신 구독 순으로
 * 클라이언트 박스를 채운다(상한 초과분은 가장 오래된 것부터 탈락).
 * Compute the effective upstream box set: warm regions always included, then
 * unique client boxes newest-first — the oldest client boxes are the ones
 * dropped beyond the cap.
 */
function computeUpstreamBoxes() {
  const boxes = [...WARM_REGION_BOXES];
  const keys = new Set(boxes.map(boxKey));

  const clientBoxes = [];
  for (const client of clients) {
    for (const box of client.boxes) {
      clientBoxes.push({ box, subscribedAt: client.subscribedAt });
    }
  }
  clientBoxes.sort((a, b) => b.subscribedAt - a.subscribedAt);

  for (const { box } of clientBoxes) {
    if (boxes.length >= MAX_UPSTREAM_BOXES) break;
    const key = boxKey(box);
    if (keys.has(key)) continue;
    keys.add(key);
    boxes.push(box);
  }
  return boxes;
}

function pushUpstreamSubscription() {
  if (!API_KEY) return;
  if (!upstreamSocket || upstreamSocket.readyState !== WebSocket.OPEN) return;
  const boxes = computeUpstreamBoxes();
  try {
    upstreamSocket.send(
      JSON.stringify({ APIkey: API_KEY, BoundingBoxes: boxes }),
    );
    currentUpstreamBoxes = boxes;
    console.log("[Proxy] Upstream subscription updated:", {
      boxes: boxes.length,
    });
  } catch (err) {
    console.error("[Proxy] Failed to update upstream subscription:", err?.message || err);
  }
}

/** 박스 집합이 실제로 바뀌었을 때만 2초 디바운스로 재구독. / debounce 2s on change. */
function scheduleUpstreamResubscribe() {
  const nextKey = boxSetKey(computeUpstreamBoxes());
  if (nextKey === boxSetKey(currentUpstreamBoxes)) return;
  if (resubscribeTimer) clearTimeout(resubscribeTimer);
  resubscribeTimer = setTimeout(() => {
    resubscribeTimer = null;
    if (boxSetKey(computeUpstreamBoxes()) === boxSetKey(currentUpstreamBoxes)) return;
    pushUpstreamSubscription();
  }, RESUBSCRIBE_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// 단일 상시 업스트림 (워밍업 + 자동 재연결 + 정체 감시)
// Single persistent upstream connection: warm-up, auto-reconnect with
// exponential backoff, and a staleness watchdog.
// ---------------------------------------------------------------------------

let upstreamSocket = null;
let upstreamBackoff = UPSTREAM_MIN_BACKOFF_MS;
let upstreamReconnectTimer = null;
let upstreamConnectedSince = null;
let lastUpstreamMessageAt = null;

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
    lastUpstreamMessageAt = Date.now(); // 정체 시계를 새로 시작 / restart the staleness clock
    pushUpstreamSubscription();
    console.log("[Proxy] Upstream connected, subscribed", {
      boxes: currentUpstreamBoxes.length,
    });
  });

  socket.on("message", (eventData) => {
    let parsed;
    try {
      parsed = JSON.parse(eventData.toString());
    } catch {
      console.error("[Proxy] Upstream sent non-JSON payload; dropped.");
      return;
    }
    const now = Date.now();
    lastUpstreamMessageAt = now;

    // 한 번만 파싱하고 에러 판정: error 필드가 있고 MetaData 가 없으면
    // 업스트림 레벨 오류 → 기록만 하고 릴레이하지 않는다.
    // Parse once and detect errors structurally: an object carrying an
    // `error` field without MetaData is an upstream-level error.
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.error !== undefined &&
      !parsed.MetaData
    ) {
      console.error(
        "[Proxy] Upstream error message:",
        JSON.stringify(parsed).slice(0, 200),
      );
      return;
    }

    handleUpstreamMessage(parsed, now);
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

// 정체 감시: 30초마다 ping, 클라이언트가 붙어 있는데 90초간 메시지가 없으면
// 소켓을 강제 종료하고 백오프 재연결에 맡긴다.
// Staleness watchdog: ping every 30s; if clients are connected but no upstream
// message arrived for 90s, terminate and let backoff reconnect take over.
const upstreamWatchdogTimer = setInterval(() => {
  if (!upstreamSocket || upstreamSocket.readyState !== WebSocket.OPEN) return;
  try {
    upstreamSocket.ping();
  } catch {
    // ping 실패는 close 핸들러가 정리한다 / a failed ping is handled by close
  }
  // 클라이언트 유무와 무관하게 정체를 감지한다 — 워밍업 캐시가 이 소켓에
  // 의존하므로, 유휴 중 죽은 업스트림을 방치하면 캐시가 TTL로 비어 버린다.
  // Detect staleness regardless of connected clients — the warm cache depends
  // on this socket, and a dead-but-idle upstream lets the cache drain via TTL.
  const stale =
    lastUpstreamMessageAt !== null &&
    Date.now() - lastUpstreamMessageAt > UPSTREAM_STALE_MS;
  if (stale) {
    console.warn("[Proxy] Upstream stale for >90s; terminating for reconnect.");
    upstreamSocket.terminate();
  }
}, WATCHDOG_INTERVAL_MS);

// 클라이언트 하트비트: 30초마다 ping을 보내고, 직전 주기에 pong이 없던
// 소켓은 반쯤 닫힌 연결로 보고 정리한다 (FIN 없이 사라진 클라이언트가
// 접속 슬롯과 업스트림 박스를 영구 점유하는 것을 방지).
// Client heartbeat: ping every 30s and terminate sockets that missed the
// previous pong — half-open connections must not hold client slots and
// upstream box capacity forever.
const clientHeartbeatTimer = setInterval(() => {
  for (const client of clients) {
    if (client.isAlive === false) {
      client.socket.terminate(); // close 핸들러가 정리한다 / close handler cleans up
      continue;
    }
    client.isAlive = false;
    try {
      client.socket.ping();
    } catch {
      // ping 실패는 close/error 핸들러가 정리한다 / handled by close/error
    }
  }
}, WATCHDOG_INTERVAL_MS);

// 초당 릴레이 카운터 리셋 (전 클라이언트 공통)
// Reset per-client per-second relay counters.
const globalRateTimer = setInterval(() => {
  for (const client of clients) {
    client.relayedThisSecond = 0;
  }
}, 1000);

// 캐시 정리는 핫패스가 아닌 30초 주기 / cache pruning on a 30s interval, off the hot path.
const cachePruneTimer = setInterval(pruneAisCache, CACHE_PRUNE_INTERVAL_MS);

// seenMmsis TTL 정리는 60초 주기 / seen-MMSI TTL pruning every 60s.
const seenPruneTimer = setInterval(pruneSeenMmsis, SEEN_MMSI_PRUNE_INTERVAL_MS);

// ---------------------------------------------------------------------------
// 클라이언트 연결
// Client connection handling
// ---------------------------------------------------------------------------

wss.on("connection", (clientSocket, req) => {
  // 어떤 분기에서 닫히든 소켓 오류가 프로세스를 죽이지 못하게, 정리 로직이
  // 붙기 전에 최소한의 error 리스너부터 단다 (리스너 0개인 'error' 이벤트는
  // Node가 예외로 다시 던진다).
  // Attach a minimal error listener before anything else — an 'error' event
  // with zero listeners is re-thrown by Node and kills the process.
  clientSocket.on("error", () => {});

  // Origin 허용 목록이 설정된 경우에만 검사한다(브라우저 외 클라이언트 차단).
  // Enforce the Origin allowlist when configured (blocks third-party pages).
  if (ALLOWED_ORIGINS.length > 0) {
    const origin = req.headers.origin;
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      clientSocket.close(1008, "Origin not allowed");
      return;
    }
  }

  // 동시 접속 상한: 초과 접속은 WireError 후 정중히 닫는다.
  // Client cap: sockets beyond the limit get a WireError and are closed.
  if (clients.size >= MAX_CLIENTS) {
    sendClientError(
      clientSocket,
      "TOO_MANY_CLIENTS",
      `Proxy accepts at most ${MAX_CLIENTS} concurrent clients.`,
    );
    clientSocket.close(1013, "Server at capacity");
    return;
  }

  console.log("[Proxy] Browser connected", { clients: clients.size + 1 });

  /** @type {ProxyClient} */
  const client = {
    socket: clientSocket,
    boxes: [],
    subscribedAt: 0,
    lastSubscribeAt: 0,
    seenMmsis: new Map(),
    relayedThisSecond: 0,
    isAlive: true,
  };
  clients.add(client);

  clientSocket.on("pong", () => {
    client.isAlive = true;
  });

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

    // JSON.parse는 null/숫자/배열도 통과시킨다 — 객체가 아니면 여기서 끝.
    // (프로퍼티 접근 전에 걸러야 한 줄짜리 페이로드로 죽지 않는다.)
    // JSON.parse also accepts null/numbers/arrays; reject non-objects before
    // any property access so a one-line payload can't crash the process.
    if (
      clientRequest === null ||
      typeof clientRequest !== "object" ||
      Array.isArray(clientRequest)
    ) {
      sendClientError(
        clientSocket,
        "INVALID_REQUEST",
        "Subscription request must be a JSON object.",
      );
      return;
    }

    // 구독 처리에는 캐시 전체 스캔 + 스냅샷 전송 비용이 든다. 정상 클라이언트는
    // 400ms 디바운스로 보내므로, 그보다 촘촘한 요청은 조용히 무시한다.
    // Each subscribe costs a full cache scan + snapshot send. Legit clients
    // debounce at 400ms, so anything tighter is silently ignored.
    const receivedAt = Date.now();
    if (receivedAt - client.lastSubscribeAt < MIN_SUBSCRIBE_INTERVAL_MS) {
      return;
    }
    client.lastSubscribeAt = receivedAt;

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

    // 새 구독 영역 적용 후 즉시 캐시 스냅샷 전송 (즉시 화면 채움),
    // 이어서 업스트림 박스 집합 재계산(디바운스). seenMmsis는 초기화하지
    // 않는다 — 재구독으로 추적 상한(MAX_TRACKED_MMSI)이 리셋되는 것을 막고,
    // 오래된 항목은 TTL 정리에 맡긴다.
    // Apply the new area, push a cached snapshot immediately (instant fill),
    // then recompute the upstream box set (debounced resubscribe). seenMmsis
    // is deliberately NOT reset: resubscribing must not bypass the tracked-MMSI
    // cap; stale entries expire via the TTL prune instead.
    client.boxes = boundsResult.boxes;
    client.subscribedAt = Date.now();

    const snapshotCount = sendCachedSnapshot(client);
    scheduleUpstreamResubscribe();
    console.log("[Proxy] Client subscribed:", {
      firstBox: boundsResult.boxes[0],
      cachedSnapshot: snapshotCount,
      cacheSize: aisCache.size,
    });
  });

  clientSocket.on("close", () => {
    clients.delete(client);
    scheduleUpstreamResubscribe();
    console.log("[Proxy] Browser connection closed", {
      remainingClients: clients.size,
    });
  });

  clientSocket.on("error", () => {
    clients.delete(client);
    scheduleUpstreamResubscribe();
  });
});

// ---------------------------------------------------------------------------
// HTTP 엔드포인트: /health (확장 상태) + /search (캐시 검색)
// HTTP endpoints: extended /health and cache-backed /search.
// ---------------------------------------------------------------------------

function upstreamStateLabel() {
  if (!API_KEY) return "unconfigured";
  if (upstreamSocket) {
    if (upstreamSocket.readyState === WebSocket.OPEN) return "connected";
    if (upstreamSocket.readyState === WebSocket.CONNECTING) return "connecting";
    return "closing";
  }
  return upstreamReconnectTimer ? "reconnecting" : "disconnected";
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    upstream: "aisstream",
    apiKeyConfigured: Boolean(API_KEY),
    upstreamState: upstreamStateLabel(),
    upstreamConnected: Boolean(
      upstreamSocket && upstreamSocket.readyState === WebSocket.OPEN,
    ),
    upstreamUptimeMs: upstreamConnectedSince
      ? Date.now() - upstreamConnectedSince
      : 0,
    lastUpstreamMessageAt,
    subscribedBoxes: currentUpstreamBoxes,
    clients: clients.size,
    cacheSize: aisCache.size,
    limits: {
      maxBoundingBoxes: MAX_BOUNDING_BOXES,
      maxBoxArea: MAX_BOX_AREA,
      maxMessagesPerSecond: MAX_MESSAGES_PER_SECOND,
      maxTrackedMmsi: MAX_TRACKED_MMSI,
      cacheTtlMs: CACHE_TTL_MS,
      snapshotLimit: SNAPSHOT_LIMIT,
      maxClients: MAX_CLIENTS,
      maxUpstreamBoxes: MAX_UPSTREAM_BOXES,
    },
  });
});

// 캐시된 선박에 대한 이름 부분일치(대소문자 무시) + MMSI 접두사 검색.
// Case-insensitive substring match on cached ship names plus MMSI prefix.
app.get("/search", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(SEARCH_MAX_LIMIT, Math.floor(limitRaw)))
    : SEARCH_DEFAULT_LIMIT;

  if (!q) {
    res.json({ results: [] });
    return;
  }

  const needle = q.toLowerCase();
  const isDigits = /^\d+$/.test(q);
  const matches = [];
  for (const entry of aisCache.values()) {
    if (!entryHasPosition(entry)) continue; // 위치를 모르는 선박은 지도로 안내 불가 / can't be centered on the map
    const name = entryDisplayName(entry);
    const nameMatch = name !== null && name.toLowerCase().includes(needle);
    const mmsiMatch = isDigits && entry.mmsi.startsWith(q);
    if (!nameMatch && !mmsiMatch) continue;
    matches.push(entry);
  }
  matches.sort((a, b) => b.ts - a.ts); // 최신 보고 우선 / most recently reported first

  res.json({
    results: matches.slice(0, limit).map((entry) => ({
      mmsi: entry.mmsi,
      name: entryDisplayName(entry),
      lat: entry.lat,
      lng: entry.lng,
      sog: entry.sog,
      type: entry.static?.type ?? null,
      kind: entry.kind,
    })),
  });
});

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.error(
      `[Proxy] Port ${PORT} is already in use. Set PROXY_PORT to a free port (e.g. PROXY_PORT=8081) and restart.`,
    );
  } else {
    console.error("[Proxy] HTTP server error:", err?.message || err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`[Proxy] AIS proxy listening on port ${PORT}`);
  // 서버 기동 즉시 워밍업 시작 → 첫 클라이언트도 즉시 스냅샷 수신.
  // Start warming immediately on boot so the first client gets data instantly.
  connectUpstream();
});

// 마지막 안전망: 여기 도달한 예외는 버그지만, 공개 프록시에서 예외 한 번으로
// 전체 클라이언트 연결과 캐시를 잃는 것보다는 기록하고 계속 서비스하는 쪽을
// 택한다 (알려진 경로는 위에서 모두 개별 처리됨).
// Last-resort net: anything landing here is a bug, but for a public proxy we
// prefer logging and continuing over dropping every client and the cache.
// All known paths are handled individually above.
process.on("uncaughtException", (err) => {
  console.error("[Proxy] Uncaught exception (continuing):", err?.stack || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[Proxy] Unhandled rejection (continuing):", reason);
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("[Proxy] Shutting down...");
  clearInterval(globalRateTimer);
  clearInterval(cachePruneTimer);
  clearInterval(seenPruneTimer);
  clearInterval(upstreamWatchdogTimer);
  clearInterval(clientHeartbeatTimer);
  if (resubscribeTimer) clearTimeout(resubscribeTimer);
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
