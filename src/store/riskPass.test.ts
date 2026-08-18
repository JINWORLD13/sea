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
