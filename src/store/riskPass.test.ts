// computeRiskUpdates 통합 테스트 — 순수 함수(riskGrading)가 아니라 스토어 패스가
// 지오펜스 에지와 등급 이력을 어떻게 다루는지를 고정한다. 두 성질 모두
// "한 번 잘못 고쳐서 회귀가 났던" 지점이라 테스트로 못 박아 둔다.
// Integration tests for the store's risk pass — not the pure grading function,
// but how the pass handles geofence edges and grade history. Both properties
// were broken by an earlier fix attempt, so they are pinned here.
import { describe, it, expect, beforeEach } from "vitest";
import { useShipStore } from "./useShipStore";
import { RESTRICTED_ZONE_ALERT_MESSAGE } from "./config";
import { degToRad } from "../utils/maritimeMath";

// 부산 제한 구역: lat 35.08~35.10, lng 129.00~129.05 (useShipStore.isInRestrictedZone).
// Busan restricted zone, per useShipStore.isInRestrictedZone.
const INSIDE_ZONE = { lat: 35.09, lng: 129.02 };
const OUTSIDE_ZONE = { lat: 35.05, lng: 129.02 };

const LAT_SCALE = 111319.9;
const OWN_LAT = 35.0;
const LNG_SCALE = LAT_SCALE * Math.cos(degToRad(OWN_LAT));
// 서로 마주 보는 침로(본선 000°, 상대 180°, 각 10 kn)에서는 상대속도가
// 남북으로만 생기므로 CPA = 경도 오프셋, TCPA = 위도 간격 / 상대속도가 된다.
// Head-on courses (own 000°, target 180°, both 10 kn) make the relative
// velocity purely north-south, so CPA is exactly the longitude offset and
// TCPA the latitude gap over the closing speed.
const CLOSING_SPEED_MPS = 2 * 10 * 0.514444;
const TARGET_TCPA_S = 200;
const dLat = (TARGET_TCPA_S * CLOSING_SPEED_MPS) / LAT_SCALE;
const lngOffsetForCpa = (metres: number): number => metres / LNG_SCALE;

const resetStore = (): void => {
  useShipStore.setState({
    ships: {},
    alertFeed: [],
    selectedShipMmsi: null,
    replayGhost: null,
  });
};

const upsertOwnAndTarget = (cpaMetres: number): void => {
  useShipStore.getState().upsertShips([
    {
      id: "own",
      position: { lat: OWN_LAT, lng: 129.0 },
      cog: 0,
      speed: 10,
      kind: "vessel",
    },
    {
      id: "target",
      position: {
        lat: OWN_LAT + dLat,
        lng: 129.0 + lngOffsetForCpa(cpaMetres),
      },
      cog: 180,
      speed: 10,
      kind: "vessel",
    },
  ]);
};

const targetSeverity = (): string | undefined =>
  useShipStore.getState().ships.target?.risk?.severity;

describe("computeRiskUpdates — 지오펜스 에지 / geofence edge", () => {
  beforeEach(resetStore);

  it("진입 에지마다 선박 경보를 남기고, 전역 피드만 5분 디듀프한다", () => {
    const store = useShipStore.getState();

    // 1) 최초 진입 → 선박 경보 1건 + 피드 1건.
    store.upsertShips([{ id: "ship", position: INSIDE_ZONE, kind: "vessel" }]);
    store.checkRisks();
    expect(useShipStore.getState().ships.ship.alerts).toHaveLength(1);
    expect(useShipStore.getState().alertFeed).toHaveLength(1);

    // 2) 구역 밖으로 이탈 → 경보는 늘지 않고 플래그만 내려간다.
    store.upsertShips([{ id: "ship", position: OUTSIDE_ZONE }]);
    store.checkRisks();
    expect(useShipStore.getState().ships.ship.inRestrictedZone).toBe(false);
    expect(useShipStore.getState().ships.ship.alerts).toHaveLength(1);

    // 3) 5분 안에 재진입 → 에지는 반드시 기록된다(선박 경보 2건).
    //    디듀프가 에지를 통째로 건너뛰면 inRestrictedZone만 true가 되어
    //    체류하는 내내 이 진입은 어디에도 남지 않는다.
    store.upsertShips([{ id: "ship", position: INSIDE_ZONE }]);
    store.checkRisks();
    expect(useShipStore.getState().ships.ship.alerts).toHaveLength(2);
    expect(useShipStore.getState().ships.ship.alerts[1].message).toBe(
      RESTRICTED_ZONE_ALERT_MESSAGE,
    );

    // 전역 피드만 디듀프 대상 — 5분 창 안이므로 1건 그대로.
    expect(useShipStore.getState().alertFeed).toHaveLength(1);
  });

  // 에지 트리거의 나머지 절반. 위 테스트는 "진입/이탈/재진입"만 훑기 때문에
  // 판정이 레벨 트리거로 회귀해도 전부 통과한다 — 같은 자리에서 두 번 연속
  // 판정하는 틱이 없어서다. 체류 중 침묵을 여기서 따로 못 박는다.
  // MMSI를 위 테스트와 다르게 쓰는 이유: recentGeoFeedByMmsi는 모듈 전역이라
  // beforeEach가 지우지 않는다. 같은 MMSI를 재사용하면 앞 테스트가 남긴
  // 디듀프 타임스탬프 때문에 피드가 0건이 된다.
  it("구역 안에 머무는 동안에는 경보가 늘지 않는다", () => {
    const store = useShipStore.getState();

    store.upsertShips([
      { id: "dweller", position: INSIDE_ZONE, kind: "vessel" },
    ]);
    store.checkRisks();
    expect(useShipStore.getState().ships.dweller.alerts).toHaveLength(1);
    expect(useShipStore.getState().alertFeed).toHaveLength(1);

    // 위치 그대로 두 번 더 판정. 에지 트리거면 아무 일도 없어야 한다.
    store.checkRisks();
    store.checkRisks();
    expect(useShipStore.getState().ships.dweller.inRestrictedZone).toBe(true);
    expect(useShipStore.getState().ships.dweller.alerts).toHaveLength(1);
    expect(useShipStore.getState().alertFeed).toHaveLength(1);
  });
});

describe("computeRiskUpdates — 등급 이력 수명 / grade history lifetime", () => {
  beforeEach(resetStore);

  it("잠시 사라졌다 돌아온 선박은 히스테리시스를 유지한다", () => {
    const store = useShipStore.getState();
    store.selectShip("own");

    // CPA 300 m → danger 진입.
    upsertOwnAndTarget(300);
    store.checkRisks();
    expect(targetSeverity()).toBe("danger");

    // CPA 600 m → 진입선(500) 밖이지만 해제선(650) 안이므로 danger 유지.
    upsertOwnAndTarget(600);
    store.checkRisks();
    expect(targetSeverity()).toBe("danger");

    // 지도 확대 등으로 구독 박스 밖이 되어 한 틱 사라진 상황.
    const { own } = useShipStore.getState().ships;
    useShipStore.setState({ ships: { own } });
    store.checkRisks();

    // 같은 기하로 복귀 → 이력이 살아 있어야 danger가 유지된다.
    // 이력을 버리면 safe에서 다시 판정해 warning으로 조용히 떨어진다.
    upsertOwnAndTarget(600);
    store.checkRisks();
    expect(targetSeverity()).toBe("danger");
  });

  it("본선이 바뀌면 이력을 버린다 — 기준이 다른 판정은 이어받지 않는다", () => {
    const store = useShipStore.getState();
    store.selectShip("own");

    upsertOwnAndTarget(300);
    store.checkRisks();
    expect(targetSeverity()).toBe("danger");

    // 본선을 바꾸고 한 번 판정하면 그 시점에 기준이 갱신되며 이력이 버려진다
    // (기준 비교는 checkRisks 안에서만 일어난다).
    store.selectShip("target");
    store.checkRisks();

    // 다시 원래 본선으로 돌아와 같은 기하(600 m)를 판정 → 이력이 없으므로
    // 해제선(650)이 아니라 진입선(500) 기준이라 warning이다.
    store.selectShip("own");
    upsertOwnAndTarget(600);
    store.checkRisks();
    expect(targetSeverity()).toBe("warning");
  });
});

// 포트폴리오가 가장 앞세우는 주장 — "전체 복사 500회 → 최대 1회, 구독자 알림
// 500회 → 최대 1회, 변화 없는 틱은 아예 알리지 않음" — 을 성질로 못 박는다.
// 벤치(bench/perf.bench.ts)는 이 차이를 시간으로 재지만, 시간은 회귀를
// 막아주지 않는다. 누군가 패스를 `{ ...state.ships }` 무조건 복사나 선박별
// updateShip 호출로 "단순화"하면 벤치 숫자만 나빠지고 테스트는 통과한다.
// 여기서 보는 것은 ships 참조 동일성이다 — 구독자(useShipSnapshot)가
// `state.ships !== previousState.ships`로 렌더를 가르므로, 이 참조가
// 리렌더 발생 여부 그 자체다.
// Pins the claim the write-up leads with: one clone and one subscriber
// notification per pass, and no notification at all on an unchanged tick.
// The bench measures the same thing in milliseconds, but timings do not stop
// regressions — "simplifying" the pass to an unconditional `{ ...state.ships }`
// or a per-ship updateShip loop would only move the numbers. What is asserted
// here is `ships` reference identity, because subscribers (useShipSnapshot)
// gate rendering on `state.ships !== previousState.ships`: that reference *is*
// whether a re-render happens.
describe("computeRiskUpdates — 단일 패스 / single-pass invariants", () => {
  const FLEET_SIZE = 200;
  const ownId = "sp_own";
  const targetId = (index: number): string => `sp_t${index}`;

  // 본선과 마주 보는 침로로 선단을 세운다. CPA는 경도 오프셋과 같으므로
  // 200 m(danger)에서 20 km(safe)까지 등급이 섞이도록 흩뿌린다. 제한 구역
  // (lat 35.08~35.10)보다 남쪽이라 지오펜스 경보는 끼어들지 않는다.
  // A fleet on reciprocal courses: CPA equals the longitude offset, so
  // spreading 200 m to 20 km mixes every grade. All of it sits south of the
  // restricted zone, so no geofence alert interferes.
  const seedFleet = (): void => {
    useShipStore.getState().upsertShips([
      {
        id: ownId,
        position: { lat: OWN_LAT, lng: 129.0 },
        cog: 0,
        speed: 10,
        kind: "vessel",
      },
      ...Array.from({ length: FLEET_SIZE }, (_unused, index) => ({
        id: targetId(index),
        position: {
          lat: OWN_LAT + dLat,
          lng: 129.0 + lngOffsetForCpa(200 + index * 100),
        },
        cog: 180,
        speed: 10,
        kind: "vessel" as const,
      })),
    ]);
  };

  // ships 참조가 실제로 바뀐 횟수만 센다 — 리렌더로 이어지는 알림의 수.
  // Counts only notifications where `ships` actually changed identity.
  const countShipNotifications = (run: () => void): number => {
    let notifications = 0;
    const unsubscribe = useShipStore.subscribe((state, previous) => {
      if (state.ships !== previous.ships) notifications += 1;
    });
    try {
      run();
    } finally {
      unsubscribe();
    }
    return notifications;
  };

  beforeEach(() => {
    resetStore();
    seedFleet();
    useShipStore.getState().selectShip(ownId);
  });

  it("200척을 한꺼번에 갱신해도 알림은 1회다", () => {
    const store = useShipStore.getState();
    const notifications = countShipNotifications(() => store.checkRisks());

    expect(notifications).toBe(1);
    // 패스가 실제로 일을 했는지 확인 — 등급이 섞여 나와야 한다.
    const graded = Object.values(useShipStore.getState().ships).filter(
      (ship) => ship.risk !== undefined,
    );
    expect(graded).toHaveLength(FLEET_SIZE);
    expect(graded.some((ship) => ship.risk?.severity === "danger")).toBe(true);
    expect(graded.some((ship) => ship.risk?.severity === "safe")).toBe(true);
  });

  it("변화가 없는 틱은 ships 참조를 그대로 둔다 (리렌더 0회)", () => {
    const store = useShipStore.getState();
    store.checkRisks(); // 첫 패스에서 위험도·구역 플래그가 전부 자리를 잡는다.

    const settled = useShipStore.getState().ships;
    const notifications = countShipNotifications(() => store.checkRisks());

    expect(notifications).toBe(0);
    expect(useShipStore.getState().ships).toBe(settled);
  });

  it("바뀐 선박만 새 객체가 되고 나머지는 참조를 유지한다 (copy-on-write)", () => {
    const store = useShipStore.getState();
    store.checkRisks();

    // 표적 하나만 움직인다 — 본선을 움직이면 전원의 CPA가 바뀌어 비교가 무의미해진다.
    // Move one target only; moving the own-ship would change every CPA.
    const movedId = targetId(7);
    store.upsertShips([
      {
        id: movedId,
        position: {
          lat: OWN_LAT + dLat,
          lng: 129.0 + lngOffsetForCpa(5_000),
        },
        cog: 180,
        speed: 10,
      },
    ]);

    const before = useShipStore.getState().ships;
    const notifications = countShipNotifications(() => store.checkRisks());
    const after = useShipStore.getState().ships;

    expect(notifications).toBe(1);
    expect(after).not.toBe(before);
    expect(after[movedId]).not.toBe(before[movedId]);

    const untouched = Object.keys(before).filter((id) => id !== movedId);
    expect(untouched).toHaveLength(FLEET_SIZE); // 본선 + 나머지 표적
    for (const id of untouched) {
      expect(after[id]).toBe(before[id]);
    }
  });
});
