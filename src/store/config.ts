// 스토어/스트림 튜닝 상수와 해역 정의.
// Store & stream tuning constants and region definitions.
import type { AisStreamStatus, Region } from "./shipTypes";

export const MAX_TRACKED_SHIPS = 500;
export const MAX_PATH_POINTS = 200;
export const MAX_ALERT_FEED = 100;
// 선박별 경보 목록 상한 — 경계선 지터로 재진입이 반복돼도 무한히 자라지 않는다.
// Per-ship alert list cap — boundary-jitter re-entries cannot grow it unbounded.
export const MAX_SHIP_ALERTS = 20;
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
// 프록시가 MMSI를 9자리로 패딩하게 되어 선박 ID 표기가 바뀌었다. 구버전
// 캐시에는 패딩 전 ID("2320003")가 남아 있어 라이브 스트림의 패딩된
// ID("002320003")와 같은 선박이 두 항목으로 갈라지므로, 키를 v3로 올려
// 구버전 캐시를 무시한다.
// The proxy now zero-pads MMSIs to 9 digits, changing how ship IDs are
// written. Old caches hold pre-padding IDs ("2320003") that would split one
// vessel into two entries against the live stream's padded "002320003" — so
// bump the key to v3 and ignore them.
export const LOCAL_SHIP_CACHE_KEY = "vts:last-known-ais-ships:v3";
export const LOCAL_CACHE_TTL_MS = 10 * 60 * 1000;
export const LOCAL_CACHE_MAX_SHIPS = 500;
export const LOCAL_CACHE_PERSIST_DELAY_MS = 1500;
// 수동 캐시 삭제 후 저장을 막는 시간. 설정 화면의 "삭제됨" 안내(4초)보다
// 길게 잡아, 안내가 떠 있는 동안 캐시가 도로 생기지 않게 한다.
// How long persisting stays suppressed after a manual cache clear — longer
// than the Settings "cleared" notice (4s) so the cache cannot silently
// reappear while that notice is still on screen.
export const CACHE_CLEAR_SUPPRESS_MS = 5000;
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
