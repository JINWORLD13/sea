// localStorage 영속화 계층: 설정/함대/마지막 AIS 스냅샷을 저장·복원한다.
// Persistence layer (localStorage): settings, fleet, and the last-known AIS snapshot.
import type {
  AppSettings,
  PathPoint,
  RegionBounds,
  ShipData,
  ShipEta,
  ShipKind,
} from "./shipTypes";
import { categoryFromTypeCode } from "../utils/aisTypes";
import {
  FLEET_STORAGE_KEY,
  LOCAL_CACHE_MAX_SHIPS,
  LOCAL_CACHE_TTL_MS,
  LOCAL_SHIP_CACHE_KEY,
  MAX_PATH_POINTS,
  SETTINGS_STORAGE_KEY,
} from "./config";

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
export function sanitizeSettings(raw: Partial<AppSettings> | null | undefined): AppSettings {
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

export function loadPersistedSettings(): AppSettings {
  if (!canUseLocalStorage()) return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitizeSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function persistSettings(settings: AppSettings): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 저장 실패는 치명적이지 않다 — 세션 내 설정은 계속 동작한다.
    // Persist failures are non-fatal — in-session settings still work.
  }
}

export function loadPersistedFleet(): string[] {
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

export function persistFleet(fleetMmsis: string[]): void {
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
export function sanitizeEta(value: unknown): ShipEta | null {
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

export function loadLocalShipCache(bounds: RegionBounds): Record<string, ShipData> {
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

export function persistLocalShipCache(
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
