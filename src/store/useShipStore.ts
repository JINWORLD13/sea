// 선박 상태 스토어: 실시간 AIS 스트림 수신, 선박 병합, 위험도(CPA)/지오펜스 계산,
// 전역 경보 피드, 앱 설정/함대 영속화를 담당한다.
// Ship state store: live AIS stream ingestion, ship merging, collision (CPA) and
// geofence risk passes, the global alert feed, and settings/fleet persistence.
import { create } from "zustand";
import {
  latLngToXY,
  cogSogToVelocity,
  calculateCPA,
} from "../utils/maritimeMath";
import { categoryFromTypeCode } from "../utils/aisTypes";

export type RegionBounds = [number, number, number, number];

// ---------------------------------------------------------------------------
// 클라이언트 타입 (계약 §2) — 모든 화면이 이 파일에서 import 한다.
// Client types (contract §2) — canonical source, imported by every consumer.
// ---------------------------------------------------------------------------

export type ShipKind = "vessel" | "aton" | "base";

export type ShipCategory =
  | "cargo"
  | "tanker"
  | "passenger"
  | "highspeed"
  | "fishing"
  | "tug"
  | "pleasure"
  | "special"
  | "other"
  | "unknown"
  | "aton"
  | "base";

export interface ShipEta {
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface PathPoint {
  lat: number;
  lng: number;
  ts: number;
}

export interface ShipAlert {
  id: string;
  message: string;
  severity: "low" | "medium" | "high";
  timestamp: number;
}

export interface ShipData {
  id: string; // MMSI
  name: string; // 없으면 "MMSI <id>" 폴백 / fallback "MMSI <id>"
  kind: ShipKind;
  typeCode: number | null; // AIS 선종 코드 / AIS type code
  category: ShipCategory; // categoryFromTypeCode()로 파생 / derived
  // 레거시 별칭 — 항상 category와 동일. 기존 코드가 계속 컴파일되도록 유지.
  // LEGACY ALIAS — always equals `category` so untouched code keeps working.
  type: string;
  position: { lat: number; lng: number };
  speed: number; // SOG(노트), 미상이면 0 / SOG knots, 0 when unavailable
  cog: number | null;
  // TrueHeading만 (511 → null). 표시 회전값 = heading ?? cog ?? 0.
  // TrueHeading only (511 -> null). DISPLAY rotation = heading ?? cog ?? 0.
  heading: number | null;
  navStatus: number | null;
  destination?: string;
  eta?: ShipEta | null;
  imo?: string;
  callsign?: string;
  length?: number | null;
  width?: number | null;
  draught?: number | null;
  path: PathPoint[]; // 최대 200점, 각 점에 ts / max 200 points, each with ts
  risk?: {
    cpaDistance: number;
    tcpa: number;
    severity: "safe" | "warning" | "danger";
  };
  inRestrictedZone?: boolean;
  alerts: ShipAlert[];
  lastSeen?: number;
  // 레거시 호환 필드 — 실 AIS 데이터에는 존재하지 않으므로 항상 null/[].
  // Legacy compatibility fields — always null/[] from live data.
  fuel: number | null;
  motion: { pitch: number; roll: number } | null;
  wind: { speed: number; direction: number } | null;
  historicalData: { timestamp: number; fuel: number; efficiency: number }[];
}

export interface Region {
  id: "busan" | "incheon" | "singapore";
  name: string;
  center: [number, number];
  bounds: RegionBounds;
}

export interface AisStreamStatus {
  state: "idle" | "connecting" | "live" | "reconnecting" | "error";
  error: string | null;
  bounds: RegionBounds | null;
  lastMessageAt: number | null;
  receivedMessages: number;
  droppedMessages: number;
  trackedShipLimit: number;
  reconnectAttempts: number;
}

// 전역 경보 피드 항목 (최신순, 최대 100개).
// Global alert feed entry (newest first, capped at 100).
export interface AlertEntry {
  id: string;
  mmsi: string;
  shipName: string;
  message: string; // 영어 폴백 텍스트 / English fallback text
  severity: "low" | "medium" | "high";
  timestamp: number;
  kind: "geofence" | "cpa";
}

// 영속화되는 앱 설정 (localStorage "vts:settings:v1").
// Persisted app settings (localStorage "vts:settings:v1").
export interface AppSettings {
  speedUnit: "kn" | "kmh";
  showTrails: boolean;
  showCourseVectors: boolean;
  basemap: "dark" | "light" | "osm" | "sat";
  seamarks: boolean;
}

// 항적 리플레이 고스트 — 지도가 그리고 대시보드가 구동한다(실선박은 건드리지 않음).
// Track-replay ghost — rendered by the map, driven by the Dashboard
// (the live vessel is never touched).
export interface ReplayGhost {
  mmsi: string;
  lat: number;
  lng: number;
  ts: number;
}

interface UpdateOptions {
  skipPathRecord?: boolean;
}

// 패치 규약: undefined = "변경 없음", 명시적 null = "이번 보고에서 미상".
// Patch convention: undefined = "no change", explicit null = "unavailable now".
type ShipPatch = Partial<Omit<ShipData, "id">> & {
  id: string;
};

interface ShipStore {
  ships: Record<string, ShipData>;
  selectedShipMmsi: string | null;
  currentRegion: Region;
  fleetMmsis: string[];
  activeFleetOnly: boolean;
  marinaMode: boolean;
  searchQuery: string;
  mapCenterOverride: [number, number] | null;
  isConnected: boolean;
  streamStatus: AisStreamStatus;
  alertFeed: AlertEntry[];
  settings: AppSettings;
  replayGhost: ReplayGhost | null;

  upsertShips: (updates: ShipPatch[]) => void;
  updateShip: (
    id: string,
    data: Partial<ShipData>,
    options?: UpdateOptions,
  ) => void;
  selectShip: (mmsi: string | null) => void;
  setRegion: (id: Region["id"]) => void;
  addToFleet: (mmsi: string) => void;
  removeFromFleet: (mmsi: string) => void;
  setFleetMode: (active: boolean) => void;
  setMarinaMode: (active: boolean) => void;
  setSearchQuery: (query: string) => void;
  setMapCenterOverride: (lat: number, lng: number) => void;
  checkRisks: () => void;
  ackAlert: (mmsi: string, alertId: string) => void;
  ackFeedAlert: (id: string) => void;
  clearAlertFeed: () => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setReplayGhost: (ghost: ReplayGhost | null) => void;
  pruneStaleShips: () => void;
}

const MAX_TRACKED_SHIPS = 500;
const MAX_PATH_POINTS = 200;
const MAX_ALERT_FEED = 100;
// 동일 선박 CPA 위험 피드는 5분에 한 번만 올린다.
// CPA danger feed entries are deduped per MMSI per 5 minutes.
const CPA_FEED_DEDUPE_MS = 5 * 60 * 1000;
// 프록시 제약: 박스 면적 <= 0.25 제곱도. 안전 마진을 둬 0.22로 클램프한다.
// Proxy limit: box area must be <= 0.25 sq deg. Clamp to 0.22 for safety margin.
const MAX_SUBSCRIPTION_AREA = 0.22;
const SUBSCRIPTION_DEBOUNCE_MS = 400;
// 화면(viewport) 박스를 살짝 넓혀 패닝 시 가장자리가 비지 않게 한다.
// Pad the viewport box so panning doesn't reveal empty edges.
const VIEWPORT_BUFFER_RATIO = 0.15;
const SHIP_STALE_MS = 20 * 60 * 1000;
const AIS_FLUSH_INTERVAL_MS = 1000;
// ShipData 스키마가 바뀌었으므로 캐시 키를 v2로 올린다(구버전 캐시 무시).
// ShipData shape changed — bump the cache key to v2 (old caches are ignored).
const LOCAL_SHIP_CACHE_KEY = "vts:last-known-ais-ships:v2";
const LOCAL_CACHE_TTL_MS = 10 * 60 * 1000;
const LOCAL_CACHE_MAX_SHIPS = 500;
const LOCAL_CACHE_PERSIST_DELAY_MS = 1500;
const SETTINGS_STORAGE_KEY = "vts:settings:v1";
const FLEET_STORAGE_KEY = "vts:fleet:v1";
// 자동 재접속 백오프: 1초에서 시작해 30초 상한, ±20% 지터.
// Auto-reconnect backoff: 1s base, 30s cap, ±20% jitter.
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const RECONNECT_JITTER_RATIO = 0.2;

const RESTRICTED_ZONE_ALERT_MESSAGE = "Entered restricted fishery zone";

const createInitialStreamStatus = (): AisStreamStatus => ({
  state: "idle",
  error: null,
  bounds: null,
  lastMessageAt: null,
  receivedMessages: 0,
  droppedMessages: 0,
  trackedShipLimit: MAX_TRACKED_SHIPS,
  reconnectAttempts: 0,
});

const regions: Record<Region["id"], Region> = {
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

export const selectDisplayShips = (
  state: ShipStore,
): Record<string, ShipData> => state.ships;

// ---------------------------------------------------------------------------
// 영속화 헬퍼 (설정 / 함대 / 최근 선박 캐시)
// Persistence helpers (settings / fleet / last-known ship cache)
// ---------------------------------------------------------------------------

function canUseLocalStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

const DEFAULT_SETTINGS: AppSettings = {
  speedUnit: "kn",
  showTrails: true,
  showCourseVectors: true,
  basemap: "dark",
  seamarks: false,
};

// 저장된 설정을 필드 단위로 검증해 기본값 위에 병합한다(손상된 값은 무시).
// Validate persisted settings field-by-field over defaults (ignore corrupt values).
function sanitizeSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
  const next: AppSettings = { ...DEFAULT_SETTINGS };
  if (raw === null || raw === undefined || typeof raw !== "object") return next;
  if (raw.speedUnit === "kn" || raw.speedUnit === "kmh") {
    next.speedUnit = raw.speedUnit;
  }
  if (typeof raw.showTrails === "boolean") next.showTrails = raw.showTrails;
  if (typeof raw.showCourseVectors === "boolean") {
    next.showCourseVectors = raw.showCourseVectors;
  }
  if (
    raw.basemap === "dark" ||
    raw.basemap === "light" ||
    raw.basemap === "osm" ||
    raw.basemap === "sat"
  ) {
    next.basemap = raw.basemap;
  }
  if (typeof raw.seamarks === "boolean") next.seamarks = raw.seamarks;
  return next;
}

function loadPersistedSettings(): AppSettings {
  if (!canUseLocalStorage()) return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(settings: AppSettings): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 저장 실패는 치명적이지 않다 — 세션 내 설정은 계속 동작한다.
    // Persist failures are non-fatal — in-session settings still work.
  }
}

function loadPersistedFleet(): string[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(FLEET_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const unique = new Set<string>();
    for (const entry of parsed) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        unique.add(entry.trim());
      }
    }
    return Array.from(unique);
  } catch {
    return [];
  }
}

function persistFleet(fleetMmsis: string[]): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(FLEET_STORAGE_KEY, JSON.stringify(fleetMmsis));
  } catch {
    // 위와 동일 — 무시. Same as above — ignore.
  }
}

function isShipInsideBounds(ship: ShipData, bounds: RegionBounds): boolean {
  const { lat, lng } = ship.position;
  return (
    lat >= bounds[0] && lat <= bounds[2] && lng >= bounds[1] && lng <= bounds[3]
  );
}

// ETA 형태 검증 — 와이어/캐시 양쪽에서 재사용한다.
// Validates an ETA shape — reused for both wire and cache data.
function sanitizeEta(value: unknown): ShipEta | null {
  if (value === null || value === undefined || typeof value !== "object") {
    return null;
  }
  const eta = value as Partial<ShipEta>;
  if (
    typeof eta.month !== "number" ||
    typeof eta.day !== "number" ||
    typeof eta.hour !== "number" ||
    typeof eta.minute !== "number"
  ) {
    return null;
  }
  return { month: eta.month, day: eta.day, hour: eta.hour, minute: eta.minute };
}

// 캐시된 선박 한 척을 검증/정규화한다. 오래된 위험도·경보는 되살리지 않는다.
// Revive one cached ship with validation. Stale risk/alerts are not restored.
function reviveCachedShip(
  raw: unknown,
  fallbackSavedAt: number,
  now: number,
): ShipData | null {
  if (raw === null || typeof raw !== "object") return null;
  const candidate = raw as Partial<ShipData> & { id?: unknown };
  if (typeof candidate.id !== "string" || candidate.id.length === 0) return null;

  const position = candidate.position;
  if (
    position === null ||
    position === undefined ||
    typeof position.lat !== "number" ||
    typeof position.lng !== "number" ||
    !Number.isFinite(position.lat) ||
    !Number.isFinite(position.lng)
  ) {
    return null;
  }

  const lastSeen =
    typeof candidate.lastSeen === "number" && candidate.lastSeen > 0
      ? candidate.lastSeen
      : fallbackSavedAt;
  if (lastSeen <= 0 || now - lastSeen > LOCAL_CACHE_TTL_MS) return null;

  const kind: ShipKind =
    candidate.kind === "aton" || candidate.kind === "base"
      ? candidate.kind
      : "vessel";
  const typeCode =
    typeof candidate.typeCode === "number" && Number.isFinite(candidate.typeCode)
      ? candidate.typeCode
      : null;
  const category = categoryFromTypeCode(typeCode, kind);
  const path: PathPoint[] = Array.isArray(candidate.path)
    ? candidate.path
        .filter(
          (point): point is PathPoint =>
            point !== null &&
            typeof point === "object" &&
            typeof point.lat === "number" &&
            typeof point.lng === "number" &&
            typeof point.ts === "number",
        )
        .slice(-MAX_PATH_POINTS)
    : [];

  return {
    id: candidate.id,
    name:
      typeof candidate.name === "string" && candidate.name.length > 0
        ? candidate.name
        : "MMSI " + candidate.id,
    kind,
    typeCode,
    category,
    type: category,
    position: { lat: position.lat, lng: position.lng },
    speed:
      typeof candidate.speed === "number" && Number.isFinite(candidate.speed)
        ? candidate.speed
        : 0,
    cog: typeof candidate.cog === "number" ? candidate.cog : null,
    heading: typeof candidate.heading === "number" ? candidate.heading : null,
    navStatus:
      typeof candidate.navStatus === "number" ? candidate.navStatus : null,
    destination:
      typeof candidate.destination === "string" && candidate.destination
        ? candidate.destination
        : undefined,
    eta: sanitizeEta(candidate.eta),
    imo: typeof candidate.imo === "string" ? candidate.imo : undefined,
    callsign:
      typeof candidate.callsign === "string" ? candidate.callsign : undefined,
    length: typeof candidate.length === "number" ? candidate.length : null,
    width: typeof candidate.width === "number" ? candidate.width : null,
    draught: typeof candidate.draught === "number" ? candidate.draught : null,
    path,
    risk: undefined,
    inRestrictedZone: candidate.inRestrictedZone === true,
    alerts: [],
    lastSeen,
    fuel: null,
    motion: null,
    wind: null,
    historicalData: [],
  };
}

function loadLocalShipCache(bounds: RegionBounds): Record<string, ShipData> {
  if (!canUseLocalStorage()) return {};

  try {
    const rawCache = window.localStorage.getItem(LOCAL_SHIP_CACHE_KEY);
    if (!rawCache) return {};
    const parsed = JSON.parse(rawCache) as {
      ships?: unknown[];
      savedAt?: number;
    };
    const cachedShips = Array.isArray(parsed.ships) ? parsed.ships : [];
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : 0;
    const now = Date.now();
    const nextShips: Record<string, ShipData> = {};

    for (const rawShip of cachedShips) {
      const ship = reviveCachedShip(rawShip, savedAt, now);
      if (ship === null) continue;
      if (!isShipInsideBounds(ship, bounds)) continue;
      nextShips[ship.id] = ship;
    }

    return nextShips;
  } catch {
    return {};
  }
}

function persistLocalShipCache(
  ships: Record<string, ShipData>,
  bounds: RegionBounds | null,
): void {
  if (!bounds || !canUseLocalStorage()) return;

  try {
    const now = Date.now();
    const cachedShips = Object.values(ships)
      .filter((ship) => {
        const lastSeen = ship.lastSeen ?? 0;
        return (
          lastSeen > 0 &&
          now - lastSeen <= LOCAL_CACHE_TTL_MS &&
          isShipInsideBounds(ship, bounds)
        );
      })
      .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
      .slice(0, LOCAL_CACHE_MAX_SHIPS);

    window.localStorage.setItem(
      LOCAL_SHIP_CACHE_KEY,
      JSON.stringify({ savedAt: now, ships: cachedShips }),
    );
  } catch {
    // Local storage can be disabled or full; live AIS still works without it.
  }
}

// ---------------------------------------------------------------------------
// 선박 병합
// Ship merging
// ---------------------------------------------------------------------------

function isSamePosition(
  left: { lat: number; lng: number } | undefined,
  right: { lat: number; lng: number },
): boolean {
  return left?.lat === right.lat && left.lng === right.lng;
}

// nullable 필드 병합: undefined는 "변경 없음", null은 "이번 보고에서 미상"으로
// 명시적으로 덮어쓴다(낡은 침로/방위가 화면에 남지 않도록).
// Merge rule for nullable fields: undefined = keep previous, explicit null
// overwrites (so stale COG/heading never lingers on screen).
function pickField<T>(next: T | undefined, previous: T): T {
  return next === undefined ? previous : next;
}

function buildMergedShip(
  id: string,
  existingData: ShipData | undefined,
  data: Partial<ShipData>,
): ShipData {
  const lastSeen = data.lastSeen ?? existingData?.lastSeen ?? Date.now();
  const position =
    data.position ?? existingData?.position ?? { lat: 0, lng: 0 };

  const lastPathPoint = existingData?.path[existingData.path.length - 1];
  let path: PathPoint[];
  if (data.position !== undefined && !isSamePosition(lastPathPoint, data.position)) {
    path = [
      ...(existingData?.path ?? []),
      { lat: data.position.lat, lng: data.position.lng, ts: lastSeen },
    ].slice(-MAX_PATH_POINTS);
  } else {
    path =
      existingData?.path ??
      (data.position !== undefined
        ? [{ lat: position.lat, lng: position.lng, ts: lastSeen }]
        : []);
  }

  const kind: ShipKind = data.kind ?? existingData?.kind ?? "vessel";
  const typeCode = pickField(data.typeCode, existingData?.typeCode ?? null);
  const category = categoryFromTypeCode(typeCode, kind);

  return {
    id,
    name: data.name ?? existingData?.name ?? "MMSI " + id,
    kind,
    typeCode,
    category,
    // 레거시 별칭은 항상 category를 따른다. Legacy alias always mirrors category.
    type: category,
    position,
    speed: data.speed ?? existingData?.speed ?? 0,
    cog: pickField(data.cog, existingData?.cog ?? null),
    heading: pickField(data.heading, existingData?.heading ?? null),
    navStatus: pickField(data.navStatus, existingData?.navStatus ?? null),
    destination: data.destination ?? existingData?.destination,
    eta: data.eta ?? existingData?.eta ?? null,
    imo: data.imo ?? existingData?.imo,
    callsign: data.callsign ?? existingData?.callsign,
    length: pickField(data.length, existingData?.length ?? null),
    width: pickField(data.width, existingData?.width ?? null),
    draught: pickField(data.draught, existingData?.draught ?? null),
    path,
    risk: data.risk ?? existingData?.risk,
    inRestrictedZone: data.inRestrictedZone ?? existingData?.inRestrictedZone,
    alerts: data.alerts ?? existingData?.alerts ?? [],
    lastSeen,
    fuel: null,
    motion: null,
    wind: null,
    historicalData: existingData?.historicalData ?? [],
  };
}

// ---------------------------------------------------------------------------
// 위험도 패스 (지오펜스 + CPA)
// Risk pass (geofence + CPA)
// ---------------------------------------------------------------------------

const isInRestrictedZone = (
  regionId: Region["id"],
  lat: number,
  lng: number,
): boolean =>
  regionId === "busan" &&
  lat > 35.08 &&
  lat < 35.1 &&
  lng > 129.0 &&
  lng < 129.05;

// CPA 위험 피드 중복 방지용 — MMSI별 마지막 피드 시각.
// Dedupe map for CPA feed entries — last feed timestamp per MMSI.
const recentCpaFeedByMmsi = new Map<string, number>();

// 지오펜싱 + 충돌 위험(CPA)을 단일 패스로 계산하여 한 번의 set으로 반영한다.
// 이전 구현은 선박마다 updateShip을 개별 호출해 매번 전체 ships 객체를
// 복사(O(n²))했고, 구독자에게 n번의 갱신 알림을 보내 큰 렌더 부하를 유발했다.
// 이제 변경된 선박만 copy-on-write로 갱신하고 단일 알림만 발생시킨다.
//
// Geofencing + collision risk (CPA) are computed in a single pass and applied
// with one set(). The previous code called updateShip per ship, copying the
// whole ships object each time (O(n²)) and emitting n subscriber notifications.
// Now only changed ships are cloned (copy-on-write) with a single notification.
function computeRiskUpdates(state: ShipStore): Partial<ShipStore> {
  const regionId = state.currentRegion.id;
  const selectedId = state.selectedShipMmsi;
  const myShip = selectedId !== null ? state.ships[selectedId] : undefined;

  let myPos: ReturnType<typeof latLngToXY> | null = null;
  let myVel: ReturnType<typeof cogSogToVelocity> | null = null;
  if (myShip !== undefined) {
    myPos = latLngToXY(
      myShip.position.lat,
      myShip.position.lng,
      myShip.position.lat,
    );
    // CPA 속도 벡터는 침로(COG) 우선, 방위(heading)는 폴백이다.
    // CPA velocity vectors use course over ground first, heading as fallback.
    myVel = cogSogToVelocity(myShip.cog ?? myShip.heading ?? 0, myShip.speed);
  }

  const now = Date.now();
  let nextShips = state.ships;
  let changed = false;
  const feedAdditions: AlertEntry[] = [];

  // 중복 방지 맵이 계속 자라지 않도록 오래된 항목을 주기적으로 정리한다.
  // Keep the dedupe map bounded by evicting entries past the window.
  if (recentCpaFeedByMmsi.size > 256) {
    for (const [mmsi, at] of recentCpaFeedByMmsi) {
      if (now - at >= CPA_FEED_DEDUPE_MS) recentCpaFeedByMmsi.delete(mmsi);
    }
  }

  for (const id of Object.keys(state.ships)) {
    const ship = state.ships[id];
    const { lat, lng } = ship.position;
    const inRestricted =
      ship.kind === "vessel" && isInRestrictedZone(regionId, lat, lng);

    let nextRisk = ship.risk;
    let nextAlerts = ship.alerts;

    // 제한 구역 지오펜스: 모든 선박에 대해 "밖 → 안" 진입 에지에서만 발생.
    // Restricted-zone geofence: edge-triggered on the outside→inside
    // transition, for every vessel regardless of selection.
    if (inRestricted && ship.inRestrictedZone !== true) {
      const alertId = `geo_${id}_${now}`;
      nextAlerts = [
        ...ship.alerts,
        {
          id: alertId,
          message: RESTRICTED_ZONE_ALERT_MESSAGE,
          severity: "medium",
          timestamp: now,
        },
      ];
      feedAdditions.push({
        id: alertId,
        mmsi: id,
        shipName: ship.name,
        message: RESTRICTED_ZONE_ALERT_MESSAGE,
        severity: "medium",
        timestamp: now,
        kind: "geofence",
      });
    }

    if (
      myShip !== undefined &&
      myPos !== null &&
      myVel !== null &&
      id !== selectedId &&
      ship.kind === "vessel"
    ) {
      const otherPos = latLngToXY(lat, lng, myShip.position.lat);
      const otherVel = cogSogToVelocity(
        ship.cog ?? ship.heading ?? 0,
        ship.speed,
      );
      const cpa = calculateCPA(myPos, myVel, otherPos, otherVel);

      let severity: "safe" | "warning" | "danger" = "safe";
      if (cpa.cpaDistance < 500 && cpa.tcpa > 0 && cpa.tcpa < 360) {
        severity = "danger";
      } else if (cpa.cpaDistance < 1500 && cpa.tcpa > 0 && cpa.tcpa < 720) {
        severity = "warning";
      }
      nextRisk = {
        cpaDistance: cpa.cpaDistance,
        tcpa: cpa.tcpa,
        severity,
      };

      // 선택 선박 기준 CPA 위험은 피드에도 올린다 (MMSI당 5분에 한 번).
      // CPA danger against the selected ship also feeds the global list,
      // deduped per MMSI per 5 minutes.
      if (severity === "danger") {
        const lastFeedAt = recentCpaFeedByMmsi.get(id) ?? 0;
        if (now - lastFeedAt >= CPA_FEED_DEDUPE_MS) {
          recentCpaFeedByMmsi.set(id, now);
          feedAdditions.push({
            id: `cpa_${id}_${now}`,
            mmsi: id,
            shipName: ship.name,
            message: `Close approach: CPA ${Math.round(cpa.cpaDistance)} m / TCPA ${Math.max(1, Math.round(cpa.tcpa / 60))} min`,
            severity: "high",
            timestamp: now,
            kind: "cpa",
          });
        }
      }
    }

    const riskChanged =
      nextRisk?.severity !== ship.risk?.severity ||
      nextRisk?.cpaDistance !== ship.risk?.cpaDistance ||
      nextRisk?.tcpa !== ship.risk?.tcpa;
    const zoneChanged = ship.inRestrictedZone !== inRestricted;
    const alertsChanged = nextAlerts !== ship.alerts;

    if (riskChanged || zoneChanged || alertsChanged) {
      if (nextShips === state.ships) {
        nextShips = { ...state.ships };
      }
      nextShips[id] = {
        ...ship,
        risk: nextRisk,
        inRestrictedZone: inRestricted,
        alerts: nextAlerts,
      };
      changed = true;
    }
  }

  const result: Partial<ShipStore> = {};
  if (changed) result.ships = nextShips;
  if (feedAdditions.length > 0) {
    result.alertFeed = [...feedAdditions, ...state.alertFeed].slice(
      0,
      MAX_ALERT_FEED,
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// 스토어
// Store
// ---------------------------------------------------------------------------

export const useShipStore = create<ShipStore>((set, get) => {
  const storeInstance: ShipStore = {
    ships: {},
    selectedShipMmsi: null,
    currentRegion: regions.busan,
    // 함대/설정은 앱 시작 시 localStorage에서 복원한다.
    // Fleet & settings are restored from localStorage at store init.
    fleetMmsis: loadPersistedFleet(),
    activeFleetOnly: false,
    marinaMode: false,
    searchQuery: "",
    mapCenterOverride: null,
    isConnected: false,
    streamStatus: createInitialStreamStatus(),
    alertFeed: [],
    settings: loadPersistedSettings(),
    replayGhost: null,

    upsertShips: (updates: ShipPatch[]) => {
      if (updates.length === 0) return;
      set((state: ShipStore) => {
        const now = Date.now();
        const cutoff = now - SHIP_STALE_MS;
        const nextShips = { ...state.ships };
        let trackedCount = Object.keys(nextShips).length;
        let droppedMessages = 0;
        let changed = false;

        for (const id of Object.keys(nextShips)) {
          const ship = nextShips[id];
          if (
            id !== state.selectedShipMmsi &&
            (ship.lastSeen ?? 0) > 0 &&
            (ship.lastSeen ?? 0) < cutoff
          ) {
            delete nextShips[id];
            trackedCount -= 1;
            changed = true;
          }
        }

        for (const update of updates) {
          const existingData = nextShips[update.id];
          if (existingData === undefined) {
            // 위치가 없는 정적 정보만으로는 선박을 만들지 않는다(0,0 유령 방지).
            // Never create a ship from static-only data (no phantom at 0,0).
            if (update.position === undefined) continue;
            if (trackedCount >= MAX_TRACKED_SHIPS) {
              droppedMessages += 1;
              continue;
            }
          }

          nextShips[update.id] = buildMergedShip(update.id, existingData, {
            ...update,
            lastSeen: update.lastSeen ?? now,
          });

          if (existingData === undefined) {
            trackedCount += 1;
          }
          changed = true;
        }

        if (!changed && droppedMessages === 0) return {};
        return {
          ships: changed ? nextShips : state.ships,
          isConnected: true,
          streamStatus: {
            ...state.streamStatus,
            state: "live",
            error: null,
            lastMessageAt: now,
            reconnectAttempts: 0,
            receivedMessages:
              state.streamStatus.receivedMessages + updates.length,
            droppedMessages:
              state.streamStatus.droppedMessages + droppedMessages,
          },
        };
      });
    },

    updateShip: (
      id: string,
      data: Partial<ShipData>,
      options?: UpdateOptions,
    ) => {
      set((state: ShipStore) => {
        const existingData = state.ships[id];
        const mergedData =
          options?.skipPathRecord === true
            ? {
                ...buildMergedShip(id, existingData, data),
                path: existingData?.path ?? data.path ?? [],
              }
            : buildMergedShip(id, existingData, data);

        return {
          ships: {
            ...state.ships,
            [id]: mergedData,
          },
        };
      });
    },

    selectShip: (mmsi: string | null) => {
      set((state: ShipStore) => {
        if (state.selectedShipMmsi === mmsi) return {};

        // 선택이 바뀌면 모든 선박의 CPA 위험도를 지운다(copy-on-write) —
        // 이전 선택 기준의 낡은 위험 색상이 새 선택 화면에 남지 않도록.
        // When selection changes, clear `risk` on ALL ships (copy-on-write)
        // so stale CPA severities never render for the new selection.
        let nextShips = state.ships;
        let shipsChanged = false;
        for (const id of Object.keys(state.ships)) {
          const ship = state.ships[id];
          if (ship.risk !== undefined) {
            if (!shipsChanged) {
              nextShips = { ...state.ships };
              shipsChanged = true;
            }
            nextShips[id] = { ...ship, risk: undefined };
          }
        }

        return {
          selectedShipMmsi: mmsi,
          // 리플레이 고스트는 이전 선택에 속하므로 함께 정리한다.
          // The replay ghost belongs to the previous selection — clear it too.
          replayGhost: null,
          ...(shipsChanged ? { ships: nextShips } : {}),
        };
      });
    },

    setRegion: (id: Region["id"]) => {
      const regionData = regions[id];
      set({
        currentRegion: regionData,
        ships: {},
        selectedShipMmsi: null,
        mapCenterOverride: null,
        replayGhost: null,
      });
    },

    addToFleet: (mmsi: string) => {
      const fleetList = get().fleetMmsis;
      if (!fleetList.includes(mmsi)) {
        const nextFleet = [...fleetList, mmsi];
        persistFleet(nextFleet);
        set({ fleetMmsis: nextFleet });
      }
    },

    removeFromFleet: (mmsi: string) => {
      set((state: ShipStore) => {
        const nextFleet = state.fleetMmsis.filter((id: string) => id !== mmsi);
        persistFleet(nextFleet);
        return { fleetMmsis: nextFleet };
      });
    },

    setFleetMode: (active: boolean) => {
      set({ activeFleetOnly: active });
    },

    setMarinaMode: (active: boolean) => {
      set({ marinaMode: active });
    },

    setSearchQuery: (query: string) => {
      set({ searchQuery: query });
    },

    setMapCenterOverride: (lat: number, lng: number) => {
      set({ mapCenterOverride: [lat, lng] });
    },

    checkRisks: () => {
      set((state: ShipStore) => computeRiskUpdates(state));
    },

    ackAlert: (mmsi: string, alertId: string) => {
      set((state: ShipStore) => {
        const targetShip = state.ships[mmsi];
        if (targetShip === undefined) return {};

        return {
          ships: {
            ...state.ships,
            [mmsi]: {
              ...targetShip,
              alerts: targetShip.alerts.filter((a) => a.id !== alertId),
            },
          },
        };
      });
    },

    ackFeedAlert: (id: string) => {
      set((state: ShipStore) => {
        const nextFeed = state.alertFeed.filter((entry) => entry.id !== id);
        if (nextFeed.length === state.alertFeed.length) return {};
        return { alertFeed: nextFeed };
      });
    },

    clearAlertFeed: () => {
      set((state: ShipStore) =>
        state.alertFeed.length === 0 ? {} : { alertFeed: [] },
      );
    },

    updateSettings: (patch: Partial<AppSettings>) => {
      set((state: ShipStore) => {
        const nextSettings = sanitizeSettings({ ...state.settings, ...patch });
        persistSettings(nextSettings);
        return { settings: nextSettings };
      });
    },

    setReplayGhost: (ghost: ReplayGhost | null) => {
      set({ replayGhost: ghost });
    },

    pruneStaleShips: () => {
      set((state: ShipStore) => {
        const cutoff = Date.now() - SHIP_STALE_MS;
        const nextShips: Record<string, ShipData> = {};
        let changed = false;

        for (const [id, ship] of Object.entries(state.ships)) {
          const shouldKeep =
            id === state.selectedShipMmsi ||
            (ship.lastSeen ?? 0) === 0 ||
            (ship.lastSeen ?? 0) >= cutoff;

          if (shouldKeep) {
            nextShips[id] = ship;
          } else {
            changed = true;
          }
        }

        if (!changed) return {};
        return { ships: nextShips };
      });
    },
  };
  return storeInstance;
});

export const matchShipQuery = (ship: ShipData, query: string): boolean => {
  if (query === "") return true;
  const queryLower = query.toLowerCase();
  return (
    ship.name.toLowerCase().includes(queryLower) ||
    ship.id.toLowerCase().includes(queryLower) ||
    ship.type.toLowerCase().includes(queryLower) ||
    (ship.callsign ?? "").toLowerCase().includes(queryLower) ||
    (ship.destination ?? "").toLowerCase().includes(queryLower)
  );
};

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
