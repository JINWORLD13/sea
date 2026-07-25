// AIS 웹소켓 클라이언트: 프록시 연결, 와이어 메시지 파싱, 배치 플러시, 재접속, 구독 관리.
// AIS websocket client: proxy connection, wire parsing, batched flush, reconnect, subscription.
import type { RegionBounds, ShipData, ShipKind, ShipPatch } from "./shipTypes";
import {
  AIS_FLUSH_INTERVAL_MS,
  LOCAL_CACHE_PERSIST_DELAY_MS,
  MAX_SUBSCRIPTION_AREA,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_JITTER_RATIO,
  RECONNECT_MAX_DELAY_MS,
  SUBSCRIPTION_DEBOUNCE_MS,
  VIEWPORT_BUFFER_RATIO,
  createInitialStreamStatus,
} from "./config";
import {
  loadLocalShipCache,
  persistLocalShipCache,
  sanitizeEta,
} from "./persistence";
import { useShipStore } from "./useShipStore";

// ---------------------------------------------------------------------------
// AIS 스트림 (t-판별 와이어 프로토콜 + 자동 재접속)
// AIS stream (t-discriminated wire protocol + auto-reconnect)
// ---------------------------------------------------------------------------

let activeSocket: WebSocket | null = null;
let activeBounds: RegionBounds | null = null;
// 현재 해역(워밍업) 박스. viewport가 너무 클 때(줌아웃) 폴백으로 쓴다.
// Current region (warm) box, used as fallback when the viewport is too large.
let activeRegionBounds: RegionBounds | null = null;
let subscriptionTimer: ReturnType<typeof setTimeout> | null = null;
let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCachePersistTimer: ReturnType<typeof setTimeout> | null = null;
let hasFlushedSinceConnect = false;
// 세대 카운터: start/stop 때마다 증가시켜 이전 소켓/재접속 타이머의 콜백을
// 무효화한다(StrictMode 이중 마운트에도 안전).
// Generation counter: bumped by start/stop so callbacks from superseded
// sockets/reconnect timers become no-ops (StrictMode-safe).
let streamGeneration = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const pendingShipUpdates = new Map<string, ShipPatch>();
// 위치보다 먼저 도착한 정적 정보 보류 버퍼(위치가 오면 병합).
// Holding buffer for static data that arrived before any position
// (merged as soon as a position shows up).
const pendingStaticByMmsi = new Map<string, ShipPatch>();
const MAX_STASHED_STATICS = 300;

// --- 와이어 프로토콜 타입 (계약 §1) / Wire protocol types (contract §1) ---

interface WireEtaShape {
  month: number;
  day: number;
  hour: number;
  minute: number;
}

interface WirePosMessage {
  t: "pos";
  mmsi: string;
  lat: number;
  lng: number;
  sog: number | null;
  cog: number | null;
  hdg: number | null;
  nav: number | null;
  name: string | null;
  kind: string;
  ts: number;
}

interface WireStaticMessage {
  t: "static";
  mmsi: string;
  name: string | null;
  imo: string | null;
  callsign: string | null;
  type: number | null;
  dest: string | null;
  eta: WireEtaShape | null;
  length: number | null;
  width: number | null;
  draught: number | null;
  ts: number;
}

interface WireSnapshotShip {
  mmsi: string;
  lat: number;
  lng: number;
  sog: number | null;
  cog: number | null;
  hdg: number | null;
  nav: number | null;
  name: string | null;
  kind: string;
  ts: number;
  type: number | null;
  dest: string | null;
  eta: WireEtaShape | null;
  length: number | null;
  width: number | null;
  draught: number | null;
  imo: string | null;
  callsign: string | null;
}

interface WireSnapshotMessage {
  t: "snapshot";
  ships: WireSnapshotShip[];
}

interface WireErrorMessage {
  t: "error";
  error: string;
  message: string;
}

// --- URL 헬퍼 / URL helpers ---

const getProxyWsUrl = (): string => {
  const url = import.meta.env.VITE_PROXY_WS_URL;
  if (url && typeof url === "string") return url;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = import.meta.env.VITE_PROXY_HOST || window.location.hostname;
  const port = import.meta.env.VITE_PROXY_PORT || "8080";
  return `${protocol}//${host}:${port}`;
};

// 프록시 HTTP 엔드포인트(/health, /search)용 베이스 URL.
// Base URL for the proxy's HTTP endpoints (/health, /search).
export const getProxyHttpUrl = (): string => {
  const explicitUrl = import.meta.env.VITE_PROXY_HTTP_URL;
  if (explicitUrl && typeof explicitUrl === "string") {
    return explicitUrl.replace(/\/+$/, "");
  }
  const wsUrl = import.meta.env.VITE_PROXY_WS_URL;
  if (wsUrl && typeof wsUrl === "string") {
    return wsUrl
      .replace(/^wss:/, "https:")
      .replace(/^ws:/, "http:")
      .replace(/\/+$/, "");
  }
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const host = import.meta.env.VITE_PROXY_HOST || window.location.hostname;
  const port = import.meta.env.VITE_PROXY_PORT || "8080";
  return `${protocol}//${host}:${port}`;
};

// --- 값 검증 헬퍼 / value validation helpers ---

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asMmsi = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const normalizeShipKind = (value: unknown): ShipKind =>
  value === "aton" || value === "base" ? value : "vessel";

const isWithinBounds = (
  lat: number,
  lng: number,
  bounds: RegionBounds,
): boolean =>
  lat >= bounds[0] && lat <= bounds[2] && lng >= bounds[1] && lng <= bounds[3];

// --- 배치 플러시 / batched flushing ---

const flushPendingShipUpdates = (): void => {
  if (pendingFlushTimer !== null) {
    clearTimeout(pendingFlushTimer);
    pendingFlushTimer = null;
  }
  const updates = Array.from(pendingShipUpdates.values());
  pendingShipUpdates.clear();
  if (updates.length > 0) {
    useShipStore.getState().upsertShips(updates);
    scheduleLocalCachePersist();
  }
};

const scheduleLocalCachePersist = (): void => {
  if (pendingCachePersistTimer !== null) {
    clearTimeout(pendingCachePersistTimer);
  }

  pendingCachePersistTimer = setTimeout(() => {
    pendingCachePersistTimer = null;
    persistLocalShipCache(useShipStore.getState().ships, activeBounds);
  }, LOCAL_CACHE_PERSIST_DELAY_MS);
};

const scheduleFlush = (): void => {
  if (pendingFlushTimer !== null) return;
  // 접속 직후 첫 배치(서버 캐시 스냅샷)는 즉시 그려 초기 로딩을 빠르게.
  // 이후에는 1초 간격으로 묶어 렌더 부하를 줄인다.
  // Paint the first batch (server cache snapshot) right away for a fast
  // initial load, then settle into the 1s batching cadence.
  const delay = hasFlushedSinceConnect ? AIS_FLUSH_INTERVAL_MS : 0;
  hasFlushedSinceConnect = true;
  pendingFlushTimer = setTimeout(flushPendingShipUpdates, delay);
};

// 남은 배치를 스토어에 반영하고, activeBounds가 아직 유효한 동안 캐시를
// 저장한 뒤 스트림 타이머를 정리한다 (persist-before-null 순서 보장).
// Apply remaining batches, persist the cache while activeBounds is still
// valid, then clear stream timers (guarantees persist-before-null ordering).
const finalizeStreamState = (): void => {
  if (subscriptionTimer !== null) {
    clearTimeout(subscriptionTimer);
    subscriptionTimer = null;
  }
  if (pendingFlushTimer !== null) {
    clearTimeout(pendingFlushTimer);
    pendingFlushTimer = null;
  }
  if (pendingCachePersistTimer !== null) {
    clearTimeout(pendingCachePersistTimer);
    pendingCachePersistTimer = null;
  }
  const updates = Array.from(pendingShipUpdates.values());
  pendingShipUpdates.clear();
  pendingStaticByMmsi.clear();
  if (updates.length > 0) {
    useShipStore.getState().upsertShips(updates);
  }
  persistLocalShipCache(useShipStore.getState().ships, activeBounds);
};

const markStreamError = (error: string): void => {
  useShipStore.setState((state) => ({
    isConnected: false,
    streamStatus: {
      ...state.streamStatus,
      state: "error",
      error,
    },
  }));
};

// --- 와이어 메시지 → 패치 변환 / wire message → patch conversion ---

// 위치 필드 공통 파서 ("pos" 메시지와 스냅샷 항목이 공유).
// Shared position-field parser (used by "pos" messages and snapshot entries).
const buildPosPatch = (
  source: Pick<
    WirePosMessage,
    "mmsi" | "lat" | "lng" | "sog" | "cog" | "hdg" | "nav" | "name" | "kind" | "ts"
  >,
): ShipPatch | null => {
  const mmsi = asMmsi(source.mmsi);
  if (mmsi === null) return null;

  const lat = asFiniteNumber(source.lat);
  const lng = asFiniteNumber(source.lng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const sog = asFiniteNumber(source.sog);
  const cog = asFiniteNumber(source.cog);
  const hdg = asFiniteNumber(source.hdg);
  const nav = asFiniteNumber(source.nav);

  const patch: ShipPatch = {
    id: mmsi,
    kind: normalizeShipKind(source.kind),
    position: { lat, lng },
    speed: sog !== null && sog >= 0 ? sog : 0,
    cog: cog !== null && cog >= 0 && cog < 360 ? cog : null,
    heading: hdg !== null && hdg >= 0 && hdg < 360 ? Math.round(hdg) : null,
    navStatus:
      nav !== null && Number.isInteger(nav) && nav >= 0 && nav <= 15
        ? nav
        : null,
    lastSeen: asFiniteNumber(source.ts) ?? Date.now(),
  };

  const name = asNonEmptyString(source.name);
  if (name !== null) patch.name = name;

  return patch;
};

// 정적/항차 필드를 패치에 채운다 — 정보는 추가만 하고 null로 지우지는 않는다
// (PartB 보고에는 ETA가 없는 식으로 메시지마다 결측이 흔하기 때문).
// Fill static/voyage fields into a patch — statics only ADD information and
// never erase with null (different report types legitimately omit fields).
const applyStaticFields = (
  patch: ShipPatch,
  source: Pick<
    WireStaticMessage,
    "name" | "imo" | "callsign" | "type" | "dest" | "eta" | "length" | "width" | "draught"
  >,
): void => {
  const name = asNonEmptyString(source.name);
  if (name !== null) patch.name = name;

  const typeCode = asFiniteNumber(source.type);
  if (typeCode !== null && typeCode > 0) patch.typeCode = typeCode;

  const destination = asNonEmptyString(source.dest);
  if (destination !== null) patch.destination = destination;

  const eta = sanitizeEta(source.eta);
  if (eta !== null) patch.eta = eta;

  const imo = asNonEmptyString(source.imo);
  if (imo !== null) patch.imo = imo;

  const callsign = asNonEmptyString(source.callsign);
  if (callsign !== null) patch.callsign = callsign;

  const length = asFiniteNumber(source.length);
  if (length !== null && length > 0) patch.length = length;

  const width = asFiniteNumber(source.width);
  if (width !== null && width > 0) patch.width = width;

  const draught = asFiniteNumber(source.draught);
  if (draught !== null && draught > 0) patch.draught = draught;
};

// 구독 박스 밖 위치는 버린다 — 단, 선택 선박은 박스를 벗어나도 추적 유지.
// Drop positions outside the subscribed box — except the selected ship,
// which stays tracked even when it leaves the box.
const isPatchInScope = (patch: ShipPatch): boolean => {
  if (patch.position === undefined) return true;
  if (activeBounds === null) return true;
  if (isWithinBounds(patch.position.lat, patch.position.lng, activeBounds)) {
    return true;
  }
  return patch.id === useShipStore.getState().selectedShipMmsi;
};

const stashStaticPatch = (patch: ShipPatch): void => {
  const previous = pendingStaticByMmsi.get(patch.id);
  if (previous === undefined && pendingStaticByMmsi.size >= MAX_STASHED_STATICS) {
    // Map은 삽입 순서를 보존하므로 가장 오래된 항목을 밀어낸다.
    // Maps preserve insertion order — evict the oldest entry.
    const oldestKey = pendingStaticByMmsi.keys().next().value;
    if (oldestKey !== undefined) pendingStaticByMmsi.delete(oldestKey);
  }
  pendingStaticByMmsi.set(
    patch.id,
    previous === undefined ? patch : { ...previous, ...patch },
  );
};

const queueShipPatch = (patch: ShipPatch): void => {
  let nextPatch = patch;
  const stashedStatic = pendingStaticByMmsi.get(patch.id);
  if (stashedStatic !== undefined) {
    pendingStaticByMmsi.delete(patch.id);
    nextPatch = { ...stashedStatic, ...patch };
  }
  const pending = pendingShipUpdates.get(patch.id);
  pendingShipUpdates.set(
    patch.id,
    pending === undefined ? nextPatch : { ...pending, ...nextPatch },
  );
  scheduleFlush();
};

// --- 메시지 핸들러 / message handlers ---

const handlePosMessage = (msg: WirePosMessage): void => {
  const patch = buildPosPatch(msg);
  if (patch === null || !isPatchInScope(patch)) return;
  queueShipPatch(patch);
};

const handleStaticMessage = (msg: WireStaticMessage): void => {
  const mmsi = asMmsi(msg.mmsi);
  if (mmsi === null) return;

  const patch: ShipPatch = { id: mmsi };
  applyStaticFields(patch, msg);
  const ts = asFiniteNumber(msg.ts);
  if (ts !== null) patch.lastSeen = ts;

  const isKnown =
    pendingShipUpdates.has(mmsi) ||
    useShipStore.getState().ships[mmsi] !== undefined;
  if (isKnown) {
    queueShipPatch(patch);
    return;
  }
  // 아직 위치를 모르는 선박 — 위치 보고가 도착할 때 병합되도록 보류한다.
  // Ship without a known position yet — stash until a position arrives.
  stashStaticPatch(patch);
};

const handleSnapshotMessage = (msg: WireSnapshotMessage): void => {
  const entries = Array.isArray(msg.ships) ? msg.ships : [];
  for (const entry of entries) {
    const patch = buildPosPatch(entry);
    if (patch === null || !isPatchInScope(patch)) continue;
    applyStaticFields(patch, entry);
    queueShipPatch(patch);
  }
  // 스냅샷 청크(≤100척)는 청크당 한 번의 set으로 즉시 반영한다.
  // Snapshot chunks (≤100 ships) are applied immediately, one set() per chunk.
  flushPendingShipUpdates();
};

// 스냅샷 완료: 해당 해역에 선박이 0척이어도 스트림 자체는 정상이므로 live로 승격.
// Snapshot complete: even with zero ships in the area the stream is healthy,
// so promote the status to "live".
const handleSnapshotEnd = (): void => {
  useShipStore.setState((state) => ({
    isConnected: true,
    streamStatus: {
      ...state.streamStatus,
      state: "live",
      error: null,
      lastMessageAt: Date.now(),
      reconnectAttempts: 0,
    },
  }));
};

const handleWireError = (msg: WireErrorMessage): void => {
  const message = asNonEmptyString(msg.message) ?? asNonEmptyString(msg.error);
  markStreamError(message ?? "AIS proxy error");
};

// --- 재접속 / reconnect machinery ---

const cancelScheduledReconnect = (): void => {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
};

// 예기치 않은 종료 시 지수 백오프(+지터)로 재접속을 예약한다.
// 기존 선박 목록은 유지되어 화면이 비지 않는다.
// Schedules a reconnect with exponential backoff (+jitter) after an
// unexpected close. Existing ships are KEPT so the screen never blanks.
const scheduleReconnect = (generation: number): void => {
  if (generation !== streamGeneration || activeBounds === null) return;
  if (reconnectTimer !== null) return;

  reconnectAttempts += 1;
  const attempts = reconnectAttempts;
  const exponential = Math.min(
    RECONNECT_BASE_DELAY_MS * 2 ** (attempts - 1),
    RECONNECT_MAX_DELAY_MS,
  );
  const jitter =
    exponential * RECONNECT_JITTER_RATIO * (Math.random() * 2 - 1);
  const delay = Math.max(
    Math.round(RECONNECT_BASE_DELAY_MS / 2),
    Math.round(exponential + jitter),
  );

  useShipStore.setState((state) => ({
    isConnected: false,
    streamStatus: {
      ...state.streamStatus,
      state: "reconnecting",
      bounds: activeBounds,
      reconnectAttempts: attempts,
    },
  }));

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (generation !== streamGeneration || activeBounds === null) return;
    openAisSocket(generation);
  }, delay);
};

// --- 소켓 개설 / socket lifecycle ---

const openAisSocket = (generation: number): void => {
  let socket: WebSocket;
  try {
    socket = new WebSocket(getProxyWsUrl());
  } catch {
    scheduleReconnect(generation);
    return;
  }
  activeSocket = socket;
  hasFlushedSinceConnect = false;

  socket.onopen = () => {
    if (generation !== streamGeneration || activeSocket !== socket) {
      socket.close(1000, "stale socket");
      return;
    }

    // 열림 = 백오프 리셋. 최신 구독 박스를 다시 보낸다(그 사이 viewport가
    // 바뀌었을 수 있음). 상태는 첫 데이터/snapshotEnd에서 "live"로 승격된다.
    // Open = reset backoff. Resubscribe the latest box (the viewport may have
    // moved meanwhile). State is promoted to "live" by data / snapshotEnd.
    reconnectAttempts = 0;
    useShipStore.setState((state) => ({
      isConnected: true,
      streamStatus: {
        ...state.streamStatus,
        error: null,
      },
    }));

    if (activeBounds !== null) {
      sendSubscription(activeBounds);
    }
  };

  socket.onmessage = (event: MessageEvent) => {
    if (generation !== streamGeneration || activeSocket !== socket) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(event.data as string);
    } catch {
      return;
    }
    if (parsed === null || typeof parsed !== "object") return;

    switch ((parsed as { t?: unknown }).t) {
      case "pos":
        handlePosMessage(parsed as WirePosMessage);
        break;
      case "static":
        handleStaticMessage(parsed as WireStaticMessage);
        break;
      case "snapshot":
        handleSnapshotMessage(parsed as WireSnapshotMessage);
        break;
      case "snapshotEnd":
        handleSnapshotEnd();
        break;
      case "error":
        handleWireError(parsed as WireErrorMessage);
        break;
      default:
        // 알 수 없는 메시지는 무시(향후 프로토콜 확장 대비).
        // Ignore unknown message types (forward compatibility).
        break;
    }
  };

  socket.onerror = () => {
    if (generation !== streamGeneration || activeSocket !== socket) return;
    // 상세 종료 처리는 onclose에서 일괄 수행한다 — 여기서는 원인만 기록.
    // onclose handles the full teardown — just record the cause here.
    useShipStore.setState((state) => ({
      streamStatus: {
        ...state.streamStatus,
        error: "AIS proxy websocket error",
      },
    }));
  };

  socket.onclose = () => {
    if (activeSocket === socket) {
      activeSocket = null;
    }
    // 우리가 의도적으로 닫은 소켓(stop/restart)은 세대가 이미 올라가 있어
    // 여기서 걸러진다. 세대가 일치하는 종료는 전부 "예기치 않은 종료"다.
    // Intentional closes (stop/restart) bump the generation first, so any
    // close that reaches this point with a matching generation is unexpected.
    if (generation !== streamGeneration) return;
    if (activeBounds === null) return;
    scheduleLocalCachePersist();
    scheduleReconnect(generation);
  };
};

// --- 구독 박스 관리 / subscription box management ---

// viewport([minLat,minLng,maxLat,maxLng])를 프록시 제약(면적<=0.22)에 맞는
// 구독 박스로 변환한다. 화면이 너무 크면(줌아웃) 해역 박스로 폴백한다.
// Convert the viewport into a subscription box satisfying the proxy area limit;
// fall back to the region box when the viewport is too large (zoomed out).
const computeSubscriptionBox = (
  viewport: RegionBounds,
  regionFallback: RegionBounds | null,
): RegionBounds => {
  const [minLat, minLng, maxLat, maxLng] = viewport;
  const latSpan = Math.max(maxLat - minLat, 0);
  const lngSpan = Math.max(maxLng - minLng, 0);

  // 버퍼를 더한 화면 박스.
  // Viewport box with padding.
  const latPad = latSpan * VIEWPORT_BUFFER_RATIO;
  const lngPad = lngSpan * VIEWPORT_BUFFER_RATIO;
  const buffered: RegionBounds = [
    Math.max(-90, minLat - latPad),
    Math.max(-180, minLng - lngPad),
    Math.min(90, maxLat + latPad),
    Math.min(180, maxLng + lngPad),
  ];
  const bufferedArea =
    (buffered[2] - buffered[0]) * (buffered[3] - buffered[1]);

  if (bufferedArea > 0 && bufferedArea <= MAX_SUBSCRIPTION_AREA) {
    return buffered;
  }

  // 줌아웃: 화면이 허용 면적보다 크다 → 해역 박스로 폴백(클라이언트에서 클러스터링).
  // Zoomed out: viewport exceeds the limit → use the region box, cluster on client.
  if (regionFallback !== null) return regionFallback;

  // 폴백이 없으면 화면 중심 기준 최대 허용 박스를 만든다.
  // Without a fallback, build a max-area box centered on the viewport.
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const half = Math.sqrt(MAX_SUBSCRIPTION_AREA) / 2;
  return [
    Math.max(-90, centerLat - half),
    Math.max(-180, centerLng - half),
    Math.min(90, centerLat + half),
    Math.min(180, centerLng + half),
  ];
};

const sendSubscription = (box: RegionBounds): void => {
  if (activeSocket === null || activeSocket.readyState !== WebSocket.OPEN) {
    return;
  }
  activeSocket.send(
    JSON.stringify({
      BoundingBoxes: [
        [
          [box[0], box[1]],
          [box[2], box[3]],
        ],
      ],
    }),
  );
};

// 구독 박스 밖 선박을 즉시 정리해 스토어를 가볍게 유지한다(선택 선박은 보존).
// Drop ships outside the new box right away to keep the store light (keep selected).
const pruneShipsOutsideBox = (box: RegionBounds): void => {
  useShipStore.setState((state) => {
    const nextShips: Record<string, ShipData> = {};
    let changed = false;
    for (const [id, ship] of Object.entries(state.ships)) {
      if (
        id === state.selectedShipMmsi ||
        isWithinBounds(ship.position.lat, ship.position.lng, box)
      ) {
        nextShips[id] = ship;
      } else {
        changed = true;
      }
    }
    if (!changed) return {};
    return { ships: nextShips };
  });
};

// 지도 이동/줌 종료 시 호출. 디바운스 후 같은 소켓으로 구독 영역만 갱신한다.
// 재접속 대기 중에도 activeBounds를 갱신해 두면 다음 open 때 최신 박스로 구독한다.
// Called on map move/zoom end. Debounced, then refreshes the subscription area
// on the existing socket. Also updates activeBounds while a reconnect is
// pending so the next open resubscribes the freshest box.
export const updateViewportSubscription = (viewport: RegionBounds): void => {
  if (activeBounds === null) return;

  if (subscriptionTimer !== null) {
    clearTimeout(subscriptionTimer);
  }
  subscriptionTimer = setTimeout(() => {
    subscriptionTimer = null;
    if (activeBounds === null) return;
    const box = computeSubscriptionBox(viewport, activeRegionBounds);
    activeBounds = box;
    sendSubscription(box);
    pruneShipsOutsideBox(box);
  }, SUBSCRIPTION_DEBOUNCE_MS);
};

export const startAisStream = (bounds: RegionBounds): void => {
  // 세대를 먼저 올려 이전 소켓/재접속 콜백을 전부 무효화한다.
  // Bump the generation first so every superseded callback becomes a no-op.
  streamGeneration += 1;
  const generation = streamGeneration;
  cancelScheduledReconnect();
  reconnectAttempts = 0;

  const previousSocket = activeSocket;
  activeSocket = null;
  if (previousSocket !== null) {
    previousSocket.close(1000, "resubscribe");
  }

  // 이전 해역의 잔여 배치를 반영하고 캐시를 저장한 뒤 새 해역으로 전환한다.
  // Flush leftovers & persist the cache for the OLD area, then switch over.
  finalizeStreamState();

  activeBounds = bounds;
  activeRegionBounds = bounds;
  hasFlushedSinceConnect = false;

  const cachedShips = loadLocalShipCache(bounds);
  useShipStore.setState({
    ships: cachedShips,
    isConnected: false,
    streamStatus: {
      ...createInitialStreamStatus(),
      state: "connecting",
      bounds,
    },
  });

  openAisSocket(generation);
};

export const stopAisStream = (): void => {
  streamGeneration += 1;
  cancelScheduledReconnect();
  reconnectAttempts = 0;

  const socket = activeSocket;
  activeSocket = null;

  // 순서 중요: activeBounds를 null로 만들기 전에 잔여 배치 반영 + 캐시 저장.
  // Ordering fix: flush pending batches and persist the local cache BEFORE
  // nulling activeBounds (persist needs the bounds to filter by area).
  finalizeStreamState();

  activeBounds = null;
  activeRegionBounds = null;
  if (socket !== null) {
    socket.close(1000, "client stop");
  }
  useShipStore.setState({
    isConnected: false,
    streamStatus: createInitialStreamStatus(),
  });
};
