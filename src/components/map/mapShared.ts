// 지도 렌더링 튜닝 상수와 순수 헬퍼(침로 벡터 끝점, 마지막 수신 경과 포맷).
// Map-render tuning constants and pure helpers (course-vector endpoint, report-age format).
export const MAX_RENDERED_SHIPS = 250;

// 이 줌 이상에서는 개별 마커, 미만에서는 클러스터로 묶는다.
// At/above this zoom render individual markers; below it, cluster.
export const CLUSTER_MAX_ZOOM = 12;
export const CLUSTER_CELL_PX = 64;

// 침로 벡터: 선택 선박 또는 이 줌 이상에서, SOG 6분치 길이로 그린다.
// Course vector: for the selected ship or at/above this zoom, drawn with a
// length equal to 6 minutes of travel at current SOG.
export const COURSE_VECTOR_MIN_ZOOM = 13;
export const COURSE_VECTOR_MIN_SOG_KN = 0.5;

// 데드레커닝 애니메이션 한계값: 큰 점프/저줌/다수 렌더 시에는 스냅한다.
// Dead-reckoning animation thresholds: snap on big jumps / low zoom / crowds.
export const DR_LERP_DURATION_MS = 900;
export const DR_SNAP_JUMP_METERS = 500;
export const DR_MIN_ZOOM = 11;
export const DR_MAX_ANIMATED_SHIPS = 150;

// 팝업의 "마지막 수신" 경과 표시를 주기적으로 갱신하는 틱 간격.
// Tick interval that refreshes the "last report" age shown in popups.
export const REPORT_AGE_REFRESH_MS = 10_000;

// COG 방향으로 SOG 6분치(= sog kn × 1852 m × 0.1 h) 거리만큼 떨어진 지점.
// Point offset from the ship along COG by 6 minutes of travel at SOG.
export const courseVectorEnd = (
  lat: number,
  lng: number,
  cogDeg: number,
  sogKnots: number,
): [number, number] => {
  const meters = sogKnots * 1852 * 0.1;
  const rad = (cogDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng =
    Math.abs(cosLat) > 1e-6 ? (meters * Math.sin(rad)) / (111320 * cosLat) : 0;
  return [lat + dLat, lng + dLng];
};

// 마지막 AIS 수신 후 경과 시간을 "12s" / "4m 05s" / "2h 13m" 형태로 만든다.
// Format the age of the last AIS report ("12s" / "4m 05s" / "2h 13m").
export const formatReportAge = (lastSeen: number | undefined): string => {
  if (typeof lastSeen !== "number") return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - lastSeen) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
};
