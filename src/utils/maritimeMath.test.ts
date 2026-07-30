// 해상 수학 골든 케이스 — 항해 조우 상황을 그대로 시나리오로 옮겼다.
// 좌표는 미터 평면, 속도는 m/s, +y = 북 / +x = 동.
// Golden cases for the maritime math, written as the encounter situations a
// navigator actually sees. Metres on a local plane, m/s, +y = north, +x = east.
import { describe, it, expect } from "vitest";
import {
  calculateCPA,
  cogSogToVelocity,
  latLngToXY,
  degToRad,
} from "./maritimeMath";

const KN_TO_MPS = 0.514444;

describe("calculateCPA — 조우 상황 / encounter situations", () => {
  it("정면 대치: 2 km 간격, 각 10 m/s → 100초 뒤 CPA 0 m", () => {
    // 마주보고 접근하면 최근접 거리는 0이고, 남은 시간은 거리 / 상대속도.
    // Head-on: CPA collapses to zero, TCPA = range / closing speed.
    const r = calculateCPA(
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 0, y: 2000 },
      { x: 0, y: -10 },
    );
    expect(r.cpaDistance).toBeCloseTo(0, 6);
    expect(r.tcpa).toBeCloseTo(100, 6);
  });

  it("직각 횡단: 두 배가 같은 지점에 동시 도달 → CPA 0 m", () => {
    // 횡단 조우. 거리만 보면 지금은 1.4 km 떨어져 있어 안전해 보인다.
    // Crossing. By range alone they are 1.4 km apart and look safe right now.
    const r = calculateCPA(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 1000, y: 1000 },
      { x: 0, y: -10 },
    );
    expect(r.cpaDistance).toBeCloseTo(0, 6);
    expect(r.tcpa).toBeCloseTo(100, 6);
  });

  it("추월: 뒤에서 두 배 빠른 배가 횡방향 100 m를 두고 지나감", () => {
    const r = calculateCPA(
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 100, y: -1000 },
      { x: 0, y: 10 },
    );
    expect(r.cpaDistance).toBeCloseTo(100, 6);
    expect(r.tcpa).toBeCloseTo(200, 6);
  });

  it("정지 표적: 본선만 움직여도 CPA는 성립한다", () => {
    const r = calculateCPA(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 1000, y: 300 },
      { x: 0, y: 0 },
    );
    expect(r.cpaDistance).toBeCloseTo(300, 6);
    expect(r.tcpa).toBeCloseTo(100, 6);
  });
});

describe("calculateCPA — 수치 예외 / numerical edge cases", () => {
  it("평행 항주(상대속도 0): 0으로 나누지 않고 현재 거리를 CPA로 쓴다", () => {
    // 같은 침로·같은 속력이면 dVSq = 0 → tcpa 식이 발산한다.
    // Identical course and speed makes dVSq zero; the TCPA expression blows up.
    const r = calculateCPA(
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 500, y: 0 },
      { x: 0, y: 10 },
    );
    expect(Number.isFinite(r.cpaDistance)).toBe(true);
    expect(Number.isFinite(r.tcpa)).toBe(true);
    expect(r.cpaDistance).toBeCloseTo(500, 6);
    expect(r.tcpa).toBe(0);
  });

  it("거의 평행(부동소수점 잔차)에서도 발산하지 않는다", () => {
    const r = calculateCPA(
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 500, y: 0 },
      { x: 1e-7, y: 10 },
    );
    expect(Number.isFinite(r.cpaDistance)).toBe(true);
    expect(r.cpaDistance).toBeLessThan(1e6);
  });

  it("이미 이격 중: 최근접점이 과거면 TCPA 0 + 현재 거리", () => {
    // 이 케이스가 오경보의 주범이다. 거리만 보면 1 km라 warning으로 뜨지만
    // 실제로는 서로 멀어지는 중이므로 조치가 필요 없다.
    // This is the false-alarm case: 1 km apart looks like a warning by range,
    // but they are separating and need no action.
    const r = calculateCPA(
      { x: 0, y: 0 },
      { x: 0, y: -10 },
      { x: 0, y: 1000 },
      { x: 0, y: 10 },
    );
    expect(r.tcpa).toBe(0);
    expect(r.cpaDistance).toBeCloseTo(1000, 6);
  });

  it("양쪽 다 정지: 상대속도 0 경로로 떨어져 유한값을 낸다", () => {
    const r = calculateCPA(
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 300, y: 400 },
      { x: 0, y: 0 },
    );
    expect(r.cpaDistance).toBeCloseTo(500, 6);
    expect(r.tcpa).toBe(0);
  });
});

describe("latLngToXY — 위도 보정 / longitude convergence", () => {
  it("부산(35°N)에서 경도 1도는 111 km가 아니라 약 91 km다", () => {
    // 보정 없이 위경도를 그대로 빼면 동서 거리를 약 22% 과대평가한다.
    // Skipping the cos(lat) factor overestimates east-west range by ~22% here.
    const refLat = 35.1;
    const a = latLngToXY(refLat, 129.0, refLat);
    const b = latLngToXY(refLat, 130.0, refLat);
    const dx = b.x - a.x;
    expect(dx).toBeCloseTo(111319.9 * Math.cos(degToRad(refLat)), 3);
    expect(dx).toBeLessThan(111319.9 * 0.83);
    expect(111319.9 / dx - 1).toBeGreaterThan(0.2); // 무보정 시 20% 이상 오차
  });

  it("위도 1도는 위도와 무관하게 약 111.3 km다", () => {
    const a = latLngToXY(35.0, 129.0, 35.0);
    const b = latLngToXY(36.0, 129.0, 35.0);
    expect(b.y - a.y).toBeCloseTo(111319.9, 3);
  });

  it("적도에서는 경도 축척이 위도 축척과 같아진다", () => {
    const a = latLngToXY(0, 0, 0);
    const b = latLngToXY(0, 1, 0);
    expect(b.x - a.x).toBeCloseTo(111319.9, 3);
  });

  it("500 m 임계값 판정: 보정 유무가 등급을 바꾼다", () => {
    // 부산 앞바다에서 경도로만 0.005° 떨어진 두 점 = 실제 약 455 m.
    // 보정을 빠뜨리면 556 m로 계산돼 danger(500 m 미만)를 놓친다.
    // 0.005° of longitude off Busan is ~455 m; uncorrected it reads 556 m and
    // would fall outside the 500 m danger threshold.
    const refLat = 35.1;
    const corrected =
      latLngToXY(refLat, 129.005, refLat).x - latLngToXY(refLat, 129.0, refLat).x;
    const uncorrected = 0.005 * 111319.9;
    expect(corrected).toBeLessThan(500);
    expect(uncorrected).toBeGreaterThan(500);
  });
});

describe("cogSogToVelocity — 나침반각 → 수학각 / compass to math angle", () => {
  it("COG 0°(북)는 +y 성분만 갖는다", () => {
    const v = cogSogToVelocity(0, 10);
    expect(v.x).toBeCloseTo(0, 9);
    expect(v.y).toBeCloseTo(10 * KN_TO_MPS, 9);
  });

  it("COG 90°(동)는 +x 성분만 갖는다", () => {
    const v = cogSogToVelocity(90, 10);
    expect(v.x).toBeCloseTo(10 * KN_TO_MPS, 9);
    expect(v.y).toBeCloseTo(0, 9);
  });

  it("COG 180°(남)는 -y, 270°(서)는 -x다", () => {
    const s = cogSogToVelocity(180, 10);
    expect(s.y).toBeCloseTo(-10 * KN_TO_MPS, 9);
    const w = cogSogToVelocity(270, 10);
    expect(w.x).toBeCloseTo(-10 * KN_TO_MPS, 9);
  });

  it("노트를 m/s로 환산한다 (20 kn ≈ 10.29 m/s)", () => {
    const v = cogSogToVelocity(90, 20);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(10.28888, 5);
  });

  it("속력 0이면 침로와 무관하게 영벡터다", () => {
    for (const cog of [0, 45, 123.4, 359.9]) {
      const v = cogSogToVelocity(cog, 0);
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(0, 12);
    }
  });
});

describe("통합 — 위경도에서 곧장 위험 판정까지 / lat-lng to risk", () => {
  it("부산항 정면 조우: 실제 좌표·침로·속력으로 CPA가 0에 수렴한다", () => {
    // 남행 12 kn 선박과 북행 12 kn 선박이 같은 경도선 위에서 마주친다.
    const refLat = 35.1;
    const a = latLngToXY(35.08, 129.04, refLat);
    const b = latLngToXY(35.12, 129.04, refLat);
    const va = cogSogToVelocity(0, 12); // 북
    const vb = cogSogToVelocity(180, 12); // 남
    const r = calculateCPA(a, va, b, vb);

    expect(r.cpaDistance).toBeCloseTo(0, 3);
    // 약 4.45 km를 합속력 12.35 m/s로 좁힌다 → 6분 남짓.
    expect(r.tcpa).toBeGreaterThan(300);
    expect(r.tcpa).toBeLessThan(400);
  });
});
