// 해양 수학 모듈: 거리, 속도, 충돌 위험(CPA/TCPA) 등을 계산합니다.
// Maritime math: distance, speed, collision risk (CPA/TCPA). Formulas follow maritime convention.
export interface Vector2 {
  x: number;
  y: number;
}

export const degToRad = (deg: number): number => (deg * Math.PI) / 180;

// 위도/경도를 기준 위도(refLat) 주변의 평면 미터 좌표로 변환 (등거리 원통 근사).
// Lat/lng -> local planar metres via an equirectangular approximation around refLat.
export const latLngToXY = (
  lat: number,
  lng: number,
  refLat: number,
): Vector2 => {
  const latScale = 111319.9; // 위도 1도당 미터 / metres per degree of latitude
  const lngScale = latScale * Math.cos(degToRad(refLat));
  return { x: lng * lngScale, y: lat * latScale };
};

// 두 선박의 최근접 거리(CPA)와 도달 시간(TCPA)을 계산.
// Closest Point of Approach (CPA) distance and time-to-CPA (TCPA) for two ships.
export const calculateCPA = (
  p1: Vector2,
  v1: Vector2,
  p2: Vector2,
  v2: Vector2,
): { cpaDistance: number; tcpa: number } => {
  const dX = p2.x - p1.x;
  const dY = p2.y - p1.y;
  const dVX = v2.x - v1.x;
  const dVY = v2.y - v1.y;
  const dVSq = dVX * dVX + dVY * dVY;

  // 상대속도가 0에 가까우면(평행 침로) 현재 거리가 곧 CPA다.
  // Near-zero relative velocity (parallel tracks) -> current distance is the CPA.
  if (dVSq < 0.000001) {
    return { cpaDistance: Math.sqrt(dX * dX + dY * dY), tcpa: 0 };
  }

  const tcpa = -(dX * dVX + dY * dVY) / dVSq;

  // 최근접 시점이 과거면 이미 멀어지는 중 → 현재 거리를 반환.
  // A CPA in the past means the ships are already separating -> return current distance.
  if (tcpa < 0) {
    return { cpaDistance: Math.sqrt(dX * dX + dY * dY), tcpa: 0 };
  }

  // TCPA 시점의 두 선박 간 간격 = 초기 간격 + 상대속도 × tcpa.
  // Gap at TCPA = initial gap + relative velocity * tcpa.
  const gapX = dX + dVX * tcpa;
  const gapY = dY + dVY * tcpa;
  return { cpaDistance: Math.sqrt(gapX * gapX + gapY * gapY), tcpa };
};

// COG(진침로)·SOG(노트)를 m/s 속도 벡터로 변환. 나침반각(북=0, 시계방향)을 수학각으로 보정.
// COG/SOG -> velocity vector in m/s; converts compass bearing (0=N, clockwise) to math angle.
export const cogSogToVelocity = (cog: number, sogKnots: number): Vector2 => {
  const speedMps = sogKnots * 0.514444; // 노트 → m/s / knots to m/s
  const angleRad = degToRad(90 - cog);
  return { x: speedMps * Math.cos(angleRad), y: speedMps * Math.sin(angleRad) };
};
