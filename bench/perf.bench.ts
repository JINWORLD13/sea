// 성능 벤치마크: 문서(portfolio.md)에서 주장하는 설계 결정을 수치로 뒷받침한다.
// 실행: npm run bench
//
// 세 가지를 측정한다.
//   1. 위험 스캔 정의 — 전체 쌍 O(n²) vs 선택 본선 기준 O(n)
//   2. 스토어 갱신 패턴 — 선박별 개별 set(구 방식 재구성) vs copy-on-write 단일 패스
//   3. 스트림 배치 — 메시지 건별 반영 vs 1초 병합 flush
//
// 1은 순수 함수만 쓰고, 2·3은 실제 Zustand 스토어(useShipStore)를 그대로 사용한다.
// 구 방식(2)은 현재 코드에 남아 있지 않으므로 이 파일 안에서 같은 계산을 하는
// 형태로 재구성해 비교한다 — 계산량은 동일하고, 차이는 복사와 알림 횟수뿐이다.
//
// Performance benchmarks backing the claims in portfolio.md. Run: npm run bench
import { describe, it } from "vitest";
import {
  calculateCPA,
  cogSogToVelocity,
  latLngToXY,
} from "../src/utils/maritimeMath";
import {
  INITIAL_GRADE_STATE,
  gradeRisk,
  type RiskGradeState,
} from "../src/utils/riskGrading";
import { useShipStore } from "../src/store/useShipStore";
import type { ShipData, ShipPatch } from "../src/store/shipTypes";

const SHIP_COUNT = 500;

// 결정적 의사난수 (LCG) — 실행마다 같은 선박 배치로 측정한다.
// Deterministic PRNG (LCG) so every run measures the same fleet.
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

interface BenchShip {
  id: string;
  lat: number;
  lng: number;
  cog: number;
  speed: number;
}

// 부산항 구독 박스(34.95~35.2, 128.95~129.25) 안에 500척을 흩뿌린다.
function makeFleet(count: number): BenchShip[] {
  const rng = makeRng(42);
  const fleet: BenchShip[] = [];
  for (let i = 0; i < count; i++) {
    fleet.push({
      id: String(440000000 + i),
      lat: 34.95 + rng() * 0.25,
      lng: 128.95 + rng() * 0.3,
      cog: rng() * 360,
      speed: rng() * 20,
    });
  }
  return fleet;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

// blackhole: 결과를 소비해 JIT가 계산을 통째로 제거하지 못하게 한다.
let sink = 0;

function timeMedian(runs: number, fn: () => void): number {
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return median(samples);
}

function resetStore(): void {
  useShipStore.setState({
    ships: {},
    selectedShipMmsi: null,
    alertFeed: [],
  });
}

function toPatch(ship: BenchShip): ShipPatch {
  return {
    id: ship.id,
    position: { lat: ship.lat, lng: ship.lng },
    cog: ship.cog,
    speed: ship.speed,
    kind: "vessel",
  };
}

describe("VTS 성능 벤치마크", () => {
  it("1. 위험 스캔 정의 — 전체 쌍 O(n²) vs 본선 기준 O(n)", () => {
    const fleet = makeFleet(SHIP_COUNT);
    const refLat = fleet[0].lat;
    const positions = fleet.map((ship) =>
      latLngToXY(ship.lat, ship.lng, refLat),
    );
    const velocities = fleet.map((ship) =>
      cogSogToVelocity(ship.cog, ship.speed),
    );

    const allPairs = (): number => {
      let pairs = 0;
      for (let i = 0; i < fleet.length; i++) {
        for (let j = i + 1; j < fleet.length; j++) {
          const cpa = calculateCPA(
            positions[i],
            velocities[i],
            positions[j],
            velocities[j],
          );
          sink += cpa.cpaDistance;
          pairs += 1;
        }
      }
      return pairs;
    };

    const ownOnly = (): number => {
      let pairs = 0;
      for (let j = 1; j < fleet.length; j++) {
        const cpa = calculateCPA(
          positions[0],
          velocities[0],
          positions[j],
          velocities[j],
        );
        sink += cpa.cpaDistance;
        pairs += 1;
      }
      return pairs;
    };

    // 워밍업 후 중앙값 측정
    allPairs();
    ownOnly();
    const pairCountAll = SHIP_COUNT * (SHIP_COUNT - 1) / 2;
    const msAll = timeMedian(9, () => void allPairs());
    const msOwn = timeMedian(9, () => void ownOnly());

    console.log("\n[1] 위험 스캔 (n=500, 2초 주기 스캔 1회 기준, 중앙값/9회)");
    console.log(`    전체 쌍   : ${pairCountAll.toLocaleString()}쌍  ${msAll.toFixed(2)} ms`);
    console.log(`    본선 기준 : ${(SHIP_COUNT - 1).toLocaleString()}쌍     ${msOwn.toFixed(3)} ms`);
    console.log(`    배율      : 쌍 ${(pairCountAll / (SHIP_COUNT - 1)).toFixed(0)}x, 시간 ${(msAll / msOwn).toFixed(0)}x`);
  });

  it("2. 스토어 갱신 패턴 — 선박별 개별 set vs copy-on-write 단일 패스", () => {
    const fleet = makeFleet(SHIP_COUNT);

    // 공통 준비: 실제 스토어에 500척을 넣고 본선을 선택한다.
    const setup = (): void => {
      resetStore();
      useShipStore.getState().upsertShips(fleet.map(toPatch));
      useShipStore.getState().selectShip(fleet[0].id);
    };

    let notifications = 0;
    const unsubscribe = useShipStore.subscribe(() => {
      notifications += 1;
    });

    // 현재 방식: checkRisks() — 단일 패스 + copy-on-write + set 1회
    setup();
    notifications = 0;
    const msCurrent = timeMedian(5, () => {
      // risk를 지웠다가(선택 해제→재선택) 다시 계산해 매 회 전 선박이 갱신되게 한다.
      useShipStore.getState().selectShip(null);
      useShipStore.getState().selectShip(fleet[0].id);
      notifications = 0;
      useShipStore.getState().checkRisks();
    });
    const notifyCurrent = notifications;

    // 구 방식 재구성: 선박마다 전체 복사 + set — 계산은 위와 동일하게 수행
    const legacyPass = (): void => {
      const state = useShipStore.getState();
      const own = state.ships[fleet[0].id];
      const ownPos = latLngToXY(
        own.position.lat,
        own.position.lng,
        own.position.lat,
      );
      const ownVel = cogSogToVelocity(own.cog ?? 0, own.speed);
      const grades = new Map<string, RiskGradeState>();
      const now = Date.now();
      for (const id of Object.keys(state.ships)) {
        if (id === own.id) continue;
        const ship = state.ships[id];
        const pos = latLngToXY(
          ship.position.lat,
          ship.position.lng,
          own.position.lat,
        );
        const vel = cogSogToVelocity(ship.cog ?? 0, ship.speed);
        const cpa = calculateCPA(ownPos, ownVel, pos, vel);
        const grade = gradeRisk(
          grades.get(id) ?? INITIAL_GRADE_STATE,
          cpa.cpaDistance,
          cpa.tcpa,
          now,
        );
        grades.set(id, grade);
        const updated: ShipData = {
          ...ship,
          risk: {
            cpaDistance: cpa.cpaDistance,
            tcpa: cpa.tcpa,
            severity: grade.severity,
          },
        };
        // 구 방식의 핵심: 매 선박마다 ships 전체를 복사하고 set을 호출한다.
        useShipStore.setState((current) => ({
          ships: { ...current.ships, [id]: updated },
        }));
      }
    };

    setup();
    notifications = 0;
    const msLegacy = timeMedian(5, () => {
      useShipStore.getState().selectShip(null);
      useShipStore.getState().selectShip(fleet[0].id);
      notifications = 0;
      legacyPass();
    });
    const notifyLegacy = notifications;

    unsubscribe();

    console.log("\n[2] 위험 패스 반영 (n=500, 전 선박 갱신 1회 기준, 중앙값/5회)");
    console.log(`    구독자 알림 : 구 방식 ${notifyLegacy}회 → 현재 ${notifyCurrent}회`);
    console.log(`    소요 시간   : 구 방식 ${msLegacy.toFixed(2)} ms → 현재 ${msCurrent.toFixed(2)} ms (${(msLegacy / msCurrent).toFixed(1)}x)`);
  });

  it("3. 스트림 배치 — 메시지 건별 반영 vs 1초 병합 flush", () => {
    const fleet = makeFleet(SHIP_COUNT);
    const rng = makeRng(7);

    // 30초 분량, 초당 180건(프록시 상한) = 5,400건의 위치 보고를 만든다.
    const SECONDS = 30;
    const PER_SECOND = 180;
    const messages: ShipPatch[][] = [];
    for (let s = 0; s < SECONDS; s++) {
      const second: ShipPatch[] = [];
      for (let m = 0; m < PER_SECOND; m++) {
        const ship = fleet[Math.floor(rng() * fleet.length)];
        second.push({
          id: ship.id,
          position: {
            lat: ship.lat + (rng() - 0.5) * 0.001,
            lng: ship.lng + (rng() - 0.5) * 0.001,
          },
          cog: ship.cog,
          speed: ship.speed,
          kind: "vessel",
        });
      }
      messages.push(second);
    }

    let notifications = 0;
    const unsubscribe = useShipStore.subscribe(() => {
      notifications += 1;
    });

    // 건별 반영: 메시지 하나마다 upsertShips 호출 (배치 계층이 없다면 이렇게 된다)
    resetStore();
    useShipStore.getState().upsertShips(fleet.map(toPatch));
    notifications = 0;
    const t0 = performance.now();
    for (const second of messages) {
      for (const message of second) {
        useShipStore.getState().upsertShips([message]);
      }
    }
    const msPerMessage = performance.now() - t0;
    const notifyPerMessage = notifications;

    // 1초 병합 flush: 스트림 계층과 같은 규칙 — 같은 MMSI의 연속 보고를 Map으로
    // 병합해 초당 한 번만 반영한다.
    resetStore();
    useShipStore.getState().upsertShips(fleet.map(toPatch));
    notifications = 0;
    const t1 = performance.now();
    for (const second of messages) {
      const merged = new Map<string, ShipPatch>();
      for (const message of second) {
        const existing = merged.get(message.id);
        merged.set(
          message.id,
          existing === undefined ? message : { ...existing, ...message },
        );
      }
      useShipStore.getState().upsertShips([...merged.values()]);
    }
    const msBatched = performance.now() - t1;
    const notifyBatched = notifications;

    unsubscribe();
    resetStore();

    const total = SECONDS * PER_SECOND;
    console.log("\n[3] 스트림 반영 (500척 추적 중 위치 보고 5,400건 = 초당 180건 x 30초)");
    console.log(`    건별 반영 : set ${notifyPerMessage.toLocaleString()}회, ${msPerMessage.toFixed(0)} ms`);
    console.log(`    1초 병합  : set ${notifyBatched}회, ${msBatched.toFixed(0)} ms (${(msPerMessage / msBatched).toFixed(1)}x)`);
    console.log(`    메시지    : ${total.toLocaleString()}건 (손실 없음 — 병합은 같은 배의 연속 보고를 최신값으로 접는 것)`);
    console.log(`    sink=${sink.toFixed(0)} (dead-code 방지용)\n`);
  });
});
