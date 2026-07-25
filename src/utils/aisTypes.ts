// AIS 선종 코드/항해 상태 공용 유틸리티.
// 지도·대시보드·페이지가 모두 이 모듈을 통해 동일한 분류/색상/라벨 키를 사용한다.
// Shared AIS ship-type & navigational-status utilities.
// Map, dashboard and pages all derive category, color and label keys from here
// so the visual language stays consistent across the app.
import type { ShipCategory, ShipEta, ShipKind } from "../store/shipTypes";

// AIS 선종 코드(0~99)를 화면용 카테고리로 변환한다.
// 코드가 없거나 0이면 "unknown", 항로표지/기지국은 kind가 우선한다.
// Maps an AIS ship-type code (0..99) to a display category.
// Missing/zero codes are "unknown"; AtoN and base stations are keyed off `kind`.
export function categoryFromTypeCode(
  code: number | null,
  kind: ShipKind,
): ShipCategory {
  if (kind === "aton") return "aton";
  if (kind === "base") return "base";
  if (code === null || !Number.isFinite(code)) return "unknown";

  const typeCode = Math.trunc(code);
  if (typeCode === 0) return "unknown";

  if (typeCode === 30) return "fishing";
  // 31-32 예인선(towing), 50 도선선, 52 예인선 — 모두 tug 버킷.
  // 31-32 towing, 50 pilot vessel, 52 tug — all share the tug bucket.
  if (typeCode === 31 || typeCode === 32) return "tug";
  // 33-35 준설/잠수/군사, 51 수색구조, 53 항만지원, 55 법집행 — special.
  // 33-35 dredging/diving/military, 51 SAR, 53 port tender, 55 law enforcement.
  if (typeCode >= 33 && typeCode <= 35) return "special";
  // 36-37 범선/유람선. 36-37 sailing / pleasure craft.
  if (typeCode === 36 || typeCode === 37) return "pleasure";
  // 40-49 고속선. 40-49 high-speed craft.
  if (typeCode >= 40 && typeCode <= 49) return "highspeed";
  if (typeCode === 50 || typeCode === 52) return "tug";
  if (typeCode === 51 || typeCode === 53 || typeCode === 55) return "special";
  // 60-69 여객선, 70-79 화물선, 80-89 유조선.
  // 60-69 passenger, 70-79 cargo, 80-89 tanker.
  if (typeCode >= 60 && typeCode <= 69) return "passenger";
  if (typeCode >= 70 && typeCode <= 79) return "cargo";
  if (typeCode >= 80 && typeCode <= 89) return "tanker";

  // 1-29, 38-39, 54, 56-59, 90-99 및 범위 밖 코드는 other.
  // 1-29, 38-39, 54, 56-59, 90-99 and out-of-range codes fall back to other.
  return "other";
}

// 카테고리별 아이콘 색상 (contract 고정 팔레트).
// Per-category icon fill colors (fixed palette from the shared contract).
const CATEGORY_COLORS: Record<ShipCategory, string> = {
  cargo: "#4ade80",
  tanker: "#f87171",
  passenger: "#60a5fa",
  highspeed: "#fbbf24",
  fishing: "#fb923c",
  tug: "#22d3ee",
  pleasure: "#e879f9",
  special: "#a78bfa",
  other: "#94a3b8",
  unknown: "#94a3b8",
  aton: "#f8fafc",
  base: "#cbd5e1",
};

export function getCategoryColor(category: ShipCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.unknown;
}

// 카테고리 → i18n 라벨 키. 번역은 i18n 패스에서 일괄 추가된다.
// Category → i18n label key. Translations are added by the dedicated i18n pass.
const CATEGORY_LABEL_KEYS: Record<ShipCategory, string> = {
  cargo: "shipTypeCargo",
  tanker: "shipTypeTanker",
  passenger: "shipTypePassenger",
  highspeed: "shipTypeHighspeed",
  fishing: "shipTypeFishing",
  tug: "shipTypeTug",
  pleasure: "shipTypePleasure",
  special: "shipTypeSpecial",
  other: "shipTypeOther",
  unknown: "shipTypeUnknown",
  aton: "shipTypeAton",
  base: "shipTypeBase",
};

export function getCategoryLabelKey(category: ShipCategory): string {
  return CATEGORY_LABEL_KEYS[category] ?? CATEGORY_LABEL_KEYS.unknown;
}

// 항해 상태 코드(NavigationalStatus 0..15) → i18n 라벨 키.
// Navigational status code (0..15) → i18n label key.
const NAV_STATUS_LABEL_KEYS: Record<number, string> = {
  0: "navUnderway",
  1: "navAnchored",
  2: "navNotUnderCommand",
  3: "navRestricted",
  4: "navConstrained",
  5: "navMoored",
  6: "navAground",
  7: "navFishing",
  8: "navSailing",
};

export function getNavStatusLabelKey(nav: number | null): string {
  if (nav === null || !Number.isInteger(nav)) return "navUnknown";
  return NAV_STATUS_LABEL_KEYS[nav] ?? "navUnknown";
}

// 정박/계류/좌초 상태 여부 — 지도에서 회전 없는 원형 심볼로 그린다.
// Anchored / moored / aground — the map renders these as non-rotating circles.
export function isStationaryStatus(nav: number | null): boolean {
  return nav === 1 || nav === 5 || nav === 6;
}

// AIS ETA(월/일/시/분, UTC)를 "MM-DD HH:mm" 문자열로 포맷한다.
// 센티널(월 0, 시 24, 분 60 등)이 섞여 있으면 정직하게 null을 반환한다.
// Formats an AIS ETA (month/day/hour/minute, UTC) as "MM-DD HH:mm".
// Returns null for sentinel/incomplete values (month 0, hour 24, minute 60...)
// instead of fabricating a time.
export function formatEta(eta: ShipEta | null | undefined): string | null {
  if (eta === null || eta === undefined) return null;
  const { month, day, hour, minute } = eta;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;

  const pad2 = (value: number): string => String(value).padStart(2, "0");
  return `${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}`;
}
