// 해양 수학 모듈: 거리, 속도, 충돌 위험(CPA/TCPA) 등을 계산합니다.
// 海洋数学モジュール：距離、速度、衝突リスク（CPA/TCPA）などを計算します。
// Maritime math: distance, speed, collision risk (CPA/TCPA). Formulas follow maritime convention.
export interface Vector2 {
  x: number;
  y: number;
}

// 각도를 라디안으로 변환
// 角度をラジアンに変換
// Converts degrees to radians.
export const degToRad = (deg: number) => {
  const result = (deg * Math.PI) / 180;
  return result;
};

// 위도/경도를 평면 좌표(XY)로 변환
// 緯度経度を平面座標(XY)에 変換
// Converts Lat/Lng to plane coordinates (XY).
export const latLngToXY = (
  lat: number,
  lng: number,
  refLat: number,
): Vector2 => {
  const latScale = 111319.9;
  const lngScale = latScale * Math.cos(degToRad(refLat));

  const xValue = lng * lngScale;
  const yValue = lat * latScale;

  const result = {
    x: xValue,
    y: yValue,
  };
  return result;
};

// 두 선박 간의 근접 거리(CPA) 및 시간(TCPA) 계산
// 二隻の船の間の最接近距離(CPA)と時間(TCPA)を計算する。
// Calculates Closest Point of Approach (CPA) and time (TCPA) between two ships.
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

  if (dVSq < 0.000001) {
    const dist = Math.sqrt(dX * dX + dY * dY);
    const resultIfSlow = {
      cpaDistance: dist,
      tcpa: 0,
    };
    return resultIfSlow;
  }

  const tcpaValue = -(dX * dVX + dY * dVY) / dVSq;

  if (tcpaValue < 0) {
    const dist2 = Math.sqrt(dX * dX + dY * dY);
    const resultIfPast = {
      cpaDistance: dist2,
      tcpa: 0,
    };
    return resultIfPast;
  }

  const cpaPos1X = p1.x + v1.x * tcpaValue;
  const cpaPos1Y = p1.y + v1.y * tcpaValue;
  const cpaPos2X = p2.x + v2.x * tcpaValue;
  const cpaPos2Y = p2.y + v2.y * tcpaValue;

  const diffX = cpaPos2X - cpaPos1X;
  const diffY = cpaPos2Y - cpaPos1Y;
  const distAtCpa = Math.sqrt(diffX * diffX + diffY * diffY);

  const finalResult = {
    cpaDistance: distAtCpa,
    tcpa: tcpaValue,
  };
  return finalResult;
};

// 선박의 속도와 방향을 속도 벡터로 변환
// 船舶の速度と方向を速度ベクトルに変換
// Converts ship's speed and course to velocity vector.
export const cogSogToVelocity = (cog: number, sogKnots: number): Vector2 => {
  const speedMpS = sogKnots * 0.514444;
  const angleRad = degToRad(90 - cog);

  const vx = speedMpS * Math.cos(angleRad);
  const vy = speedMpS * Math.sin(angleRad);

  const resultVelocity = {
    x: vx,
    y: vy,
  };
  return resultVelocity;
};
