// 스토어/스트림 튜닝 상수와 해역 정의.
// Store & stream tuning constants and region definitions.
import type { AisStreamStatus, Region } from "./shipTypes";

export const MAX_TRACKED_SHIPS = 500;
export const MAX_PATH_POINTS = 200;
export const MAX_ALERT_FEED = 100;
// 동일 선박 CPA 위험 피드는 5분에 한 번만 올린다.
// CPA danger feed entries are deduped per MMSI per 5 minutes.
export const CPA_FEED_DEDUPE_MS = 5 * 60 * 1000;
// 프록시 제약: 박스 면적 <= 0.25 제곱도. 안전 마진을 둬 0.22로 클램프한다.
// Proxy limit: box area must be <= 0.25 sq deg. Clamp to 0.22 for safety margin.
export const MAX_SUBSCRIPTION_AREA = 0.22;
export const SUBSCRIPTION_DEBOUNCE_MS = 400;
// 화면(viewport) 박스를 살짝 넓혀 패닝 시 가장자리가 비지 않게 한다.
// Pad the viewport box so panning doesn't reveal empty edges.
export const VIEWPORT_BUFFER_RATIO = 0.15;
export const SHIP_STALE_MS = 20 * 60 * 1000;
export const AIS_FLUSH_INTERVAL_MS = 1000;
// ShipData 스키마가 바뀌었으므로 캐시 키를 v2로 올린다(구버전 캐시 무시).
// ShipData shape changed — bump the cache key to v2 (old caches are ignored).
export const LOCAL_SHIP_CACHE_KEY = "vts:last-known-ais-ships:v2";
export const LOCAL_CACHE_TTL_MS = 10 * 60 * 1000;
export const LOCAL_CACHE_MAX_SHIPS = 500;
export const LOCAL_CACHE_PERSIST_DELAY_MS = 1500;
export const SETTINGS_STORAGE_KEY = "vts:settings:v1";
export const FLEET_STORAGE_KEY = "vts:fleet:v1";
// 자동 재접속 백오프: 1초에서 시작해 30초 상한, ±20% 지터.
// Auto-reconnect backoff: 1s base, 30s cap, ±20% jitter.
export const RECONNECT_BASE_DELAY_MS = 1000;
export const RECONNECT_MAX_DELAY_MS = 30000;
export const RECONNECT_JITTER_RATIO = 0.2;

export const RESTRICTED_ZONE_ALERT_MESSAGE = "Entered restricted fishery zone";

export const createInitialStreamStatus = (): AisStreamStatus => ({
  state: "idle",
  error: null,
  bounds: null,
  lastMessageAt: null,
  receivedMessages: 0,
  droppedMessages: 0,
  trackedShipLimit: MAX_TRACKED_SHIPS,
  reconnectAttempts: 0,
});

export const regions: Record<Region["id"], Region> = {
  busan: {
    id: "busan",
    name: "Busan Port",
    center: [35.1028, 129.0403],
    bounds: [34.95, 128.95, 35.2, 129.25],
  },
  incheon: {
    id: "incheon",
    name: "Incheon Port",
    center: [37.4563, 126.5841],
    bounds: [37.3, 126.35, 37.62, 126.82],
  },
  singapore: {
    id: "singapore",
    name: "Singapore Strait",
    center: [1.248, 103.84],
    bounds: [1.12, 103.55, 1.35, 104.15],
  },
};
