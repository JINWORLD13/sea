// SEATRACE 선박 도메인 타입 — 모든 화면과 스토어가 여기서 import 한다.
// SEATRACE ship-domain types — the single source imported across the app.
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

// 패치 규약: undefined = "변경 없음", 명시적 null = "이번 보고에서 미상".
// Patch convention: undefined = "no change", explicit null = "unavailable now".
export type ShipPatch = Partial<Omit<ShipData, "id">> & {
  id: string;
};

export interface ShipStore {
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
