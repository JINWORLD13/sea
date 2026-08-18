// 위험 등급 판정 테스트 — "경보가 옳게 켜지는가"보다 "쓸데없이 깜빡이지 않는가"가 핵심.
// Grading tests. The interesting property is not that the alert fires, but that
// it does not flicker.
import { describe, it, expect } from "vitest";
import {
  DEFAULT_RISK_THRESHOLDS,
  INITIAL_GRADE_STATE,
  gradeRisk,
  rawSeverity,
  type RiskGradeState,
} from "./riskGrading";

const TH = DEFAULT_RISK_THRESHOLDS;

describe("rawSeverity — 거리와 시간을 함께 본다", () => {
  it("CPA 300 m / TCPA 2분 → danger", () => {
    expect(rawSeverity(300, 120)).toBe("danger");
  });

  it("CPA 1 km / TCPA 8분 → warning", () => {
    expect(rawSeverity(1000, 480)).toBe("warning");
  });

  it("CPA 300 m라도 TCPA가 30분 뒤면 danger가 아니다", () => {
    // 가깝게 스칠 예정이지만 지금 조치할 상황은 아니다.
    expect(rawSeverity(300, 1800)).toBe("safe");
  });

  it("TCPA 0(이미 이격 중)이면 CPA 50 m라도 safe다", () => {
    // 최근접점을 이미 지난 배를 danger로 띄우면 그 경보는 전부 무시당한다.
    expect(rawSeverity(50, 0)).toBe("safe");
  });

  it("TCPA가 음수면 safe다", () => {
    expect(rawSeverity(50, -10)).toBe("safe");
  });

  it("CPA 5 km는 시간이 충분히 가까워도 safe다", () => {
    expect(rawSeverity(5000, 60)).toBe("safe");
  });
});

describe("gradeRisk — 슈미트 트리거 / hysteresis", () => {
  it("safe에서는 진입 임계값(500 m)으로 판정한다", () => {
    const s = gradeRisk(INITIAL_GRADE_STATE, 550, 120, 0);
    expect(s.severity).toBe("warning"); // danger 진입선 밖
  });

  it("danger 상태에서는 해제 임계값(650 m)까지 danger를 유지한다", () => {
    // 진입은 500 m, 해제는 650 m. 같은 550 m가 이전 상태에 따라 다르게 판정된다.
    const entered = gradeRisk(INITIAL_GRADE_STATE, 480, 120, 0);
    expect(entered.severity).toBe("danger");

    const held = gradeRisk(entered, 550, 120, 1_000);
    expect(held.severity).toBe("danger");
  });

  it("임계값을 오가도 경보가 깜빡이지 않는다", () => {
    // 495 / 505 m가 2초 간격으로 번갈아 들어오는 상황.
    // 진입선만 쓰면 danger → warning → danger로 매번 뒤집힌다.
    let s = INITIAL_GRADE_STATE;
    const seen = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      s = gradeRisk(s, i % 2 === 0 ? 495 : 505, 120, i * 2_000);
      seen.add(s.severity);
    }
    expect([...seen]).toEqual(["danger"]);
  });
});

describe("gradeRisk — 승격은 기본 임계값으로만 / upgrades use base thresholds", () => {
  it("warning 중이라도 danger 승격은 500 m 진입선에서만 일어난다", () => {
    // 넓힌 임계값(650 m)을 승격에도 쓰면 warning 선박이 550 m에서
    // danger로 올라가 버린다 — 문서상 진입선은 500 m다.
    const w: RiskGradeState = { severity: "warning", pendingSince: null };
    expect(gradeRisk(w, 550, 120, 0).severity).toBe("warning");
    expect(gradeRisk(w, 480, 120, 0).severity).toBe("danger");
  });

  it("danger 진입선(500 m)과 해제선(650 m)은 겹치지 않는다", () => {
    // 같은 640 m가 이전 등급에 따라 다르게 판정되어야 경계에서 플래핑하지 않는다.
    const w: RiskGradeState = { severity: "warning", pendingSince: null };
    expect(gradeRisk(w, 640, 120, 0).severity).toBe("warning"); // 진입선 밖

    const d: RiskGradeState = { severity: "danger", pendingSince: null };
    expect(gradeRisk(d, 640, 120, 0).severity).toBe("danger"); // 해제선 안
  });

  it("warning 유지 판정에는 넓힌 임계값이 적용된다 (1500 → 1950 m)", () => {
    const w: RiskGradeState = { severity: "warning", pendingSince: null };
    const held = gradeRisk(w, 1_800, 400, 0);
    expect(held.severity).toBe("warning");
    expect(held.pendingSince).toBeNull();
  });
});

describe("gradeRisk — 승격은 즉시, 강등은 유예 / asymmetric transitions", () => {
  it("safe → danger는 유예 없이 즉시 반영된다", () => {
    const s = gradeRisk(INITIAL_GRADE_STATE, 200, 60, 0);
    expect(s.severity).toBe("danger");
    expect(s.pendingSince).toBeNull();
  });

  it("warning → danger 승격도 즉시다", () => {
    const w: RiskGradeState = { severity: "warning", pendingSince: null };
    expect(gradeRisk(w, 200, 60, 0).severity).toBe("danger");
  });

  it("강등 조건이 20초 미만이면 등급을 유지한다", () => {
    const danger = gradeRisk(INITIAL_GRADE_STATE, 200, 60, 0);
    const t1 = gradeRisk(danger, 9_000, 60, 1_000); // 확실히 safe 영역
    expect(t1.severity).toBe("danger");
    expect(t1.pendingSince).toBe(1_000);

    const t2 = gradeRisk(t1, 9_000, 60, 15_000);
    expect(t2.severity).toBe("danger");
  });

  it("강등 조건이 20초 연속 유지되면 그때 낮춘다", () => {
    const danger = gradeRisk(INITIAL_GRADE_STATE, 200, 60, 0);
    const pending = gradeRisk(danger, 9_000, 60, 1_000);
    const dropped = gradeRisk(pending, 9_000, 60, 1_000 + TH.downgradeDwellMs);
    expect(dropped.severity).toBe("safe");
    expect(dropped.pendingSince).toBeNull();
  });

  it("중간에 다시 가까워지면 강등 타이머가 초기화된다", () => {
    const danger = gradeRisk(INITIAL_GRADE_STATE, 200, 60, 0);
    const pending = gradeRisk(danger, 9_000, 60, 1_000);
    expect(pending.pendingSince).toBe(1_000);

    // 10초 시점에 다시 위험 범위로 복귀 → 타이머 리셋.
    const back = gradeRisk(pending, 200, 60, 10_000);
    expect(back.severity).toBe("danger");
    expect(back.pendingSince).toBeNull();

    // 다시 멀어져도 리셋된 시점부터 20초를 새로 세어야 한다.
    const again = gradeRisk(back, 9_000, 60, 12_000);
    expect(again.severity).toBe("danger");
    const still = gradeRisk(again, 9_000, 60, 25_000);
    expect(still.severity).toBe("danger"); // 12s + 20s = 32s 전
    const finally_ = gradeRisk(still, 9_000, 60, 32_000);
    expect(finally_.severity).toBe("safe");
  });

  it("danger → warning 한 단계 강등에도 같은 유예가 적용된다", () => {
    const danger = gradeRisk(INITIAL_GRADE_STATE, 200, 60, 0);
    const pending = gradeRisk(danger, 1_000, 400, 1_000);
    expect(pending.severity).toBe("danger");
    const dropped = gradeRisk(pending, 1_000, 400, 30_000);
    expect(dropped.severity).toBe("warning");
  });
});

describe("gradeRisk — 불변식 / invariants", () => {
  it("등급이 유지될 때는 이전 객체를 그대로 돌려준다 (참조 동일성)", () => {
    // 스토어가 copy-on-write로 변경분만 복제하므로, 불필요한 새 객체는
    // 그 자체로 리렌더 비용이 된다.
    const s: RiskGradeState = { severity: "safe", pendingSince: null };
    expect(gradeRisk(s, 9_000, 60, 0)).toBe(s);
  });

  it("어떤 입력에도 정의된 세 등급 중 하나만 낸다", () => {
    let s = INITIAL_GRADE_STATE;
    const inputs = [0, 1, 499, 500, 501, 1_499, 1_500, 9_999, 1e9];
    const times = [-1, 0, 1, 359, 360, 719, 720, 1e6];
    for (const cpa of inputs) {
      for (const t of times) {
        s = gradeRisk(s, cpa, t, Math.abs(cpa * t) % 1e6);
        expect(["safe", "warning", "danger"]).toContain(s.severity);
      }
    }
  });

  it("NaN 입력이 들어와도 등급을 만들어내지 않는다", () => {
    // AIS 필드 결측이 NaN으로 새어 들어오는 경우의 방어선.
    const s = gradeRisk(INITIAL_GRADE_STATE, Number.NaN, Number.NaN, 0);
    expect(s.severity).toBe("safe");
  });
});
