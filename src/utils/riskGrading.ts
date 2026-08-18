// 위험 등급 판정: CPA/TCPA 원시값 -> safe / warning / danger 등급.
// 임계값 근처에서 등급이 진동(플래핑)하지 않도록 슈미트 트리거 + 강등 유예를 적용한다.
// Risk grading: raw CPA/TCPA -> safe / warning / danger.
// A Schmitt trigger plus a downgrade dwell keeps the grade from flapping at the threshold.

export type RiskSeverity = "safe" | "warning" | "danger";

export interface RiskThresholds {
  /** danger 진입 CPA 상한(m) / CPA ceiling to enter danger (m) */
  dangerCpaM: number;
  /** danger 진입 TCPA 상한(s) / TCPA horizon to enter danger (s) */
  dangerTcpaS: number;
  /** warning 진입 CPA 상한(m) / CPA ceiling to enter warning (m) */
  warningCpaM: number;
  /** warning 진입 TCPA 상한(s) / TCPA horizon to enter warning (s) */
  warningTcpaS: number;
  /**
   * 해제 임계값 배수. 이미 경보 중인 선박은 임계값을 이 배수만큼 넓혀서 판정한다.
   * 1.3이면 500m에 진입하고 650m에서 해제된다 — 진입선과 해제선을 벌리는 슈미트 트리거.
   * Release multiplier. A vessel already in alert is judged against a widened
   * threshold: enter at 500 m, release at 650 m when this is 1.3.
   */
  releaseRatio: number;
  /**
   * 강등 유예(ms). 등급을 낮출 조건이 이 시간 동안 연속으로 유지돼야 실제로 낮춘다.
   * 승격은 유예 없이 즉시 — 경보는 늦게 켜지는 것보다 늦게 꺼지는 편이 안전하다.
   * Downgrade dwell (ms): the lower grade must hold for this long before it applies.
   * Upgrades are immediate — an alert is safer late to clear than late to fire.
   */
  downgradeDwellMs: number;
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  dangerCpaM: 500,
  dangerTcpaS: 360,
  warningCpaM: 1500,
  warningTcpaS: 720,
  releaseRatio: 1.3,
  downgradeDwellMs: 20_000,
};

/** 등급 비교용 순위 / Ordinal rank for comparing grades. */
export const severityRank: Record<RiskSeverity, number> = {
  safe: 0,
  warning: 1,
  danger: 2,
};

/**
 * 등급 판정에 필요한 이력. `pendingSince`는 "강등 조건이 처음 관측된 시각"이며,
 * 조건이 풀리면 null로 되돌아간다(연속 유지된 경우에만 강등되도록).
 * Grading history. `pendingSince` is when the downgrade condition was first seen;
 * it resets to null the moment the condition lapses, so only a sustained drop counts.
 */
export interface RiskGradeState {
  severity: RiskSeverity;
  pendingSince: number | null;
}

export const INITIAL_GRADE_STATE: RiskGradeState = {
  severity: "safe",
  pendingSince: null,
};

/**
 * 히스테리시스 없는 순간 등급.
 *
 * 거리만 보지 않고 TCPA 부호와 시간 지평을 함께 본다. `tcpa > 0`은 최근접점이
 * 아직 미래라는 뜻이고, 상한(360s/720s)은 "지금 조치가 필요한가"를 가른다.
 * 이미 최근접점을 지나 멀어지는 선박(`tcpa === 0`)은 아무리 가까워도 safe다.
 *
 * Instantaneous grade with no hysteresis. Distance alone is not enough: `tcpa > 0`
 * means the closest point is still ahead, and the horizon decides whether it is
 * actionable now. A vessel already past CPA (`tcpa === 0`) is safe however close.
 */
export const rawSeverity = (
  cpaDistanceM: number,
  tcpaS: number,
  th: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
  widen = 1,
): RiskSeverity => {
  if (tcpaS <= 0) return "safe";
  if (cpaDistanceM < th.dangerCpaM * widen && tcpaS < th.dangerTcpaS * widen) {
    return "danger";
  }
  if (cpaDistanceM < th.warningCpaM * widen && tcpaS < th.warningTcpaS * widen) {
    return "warning";
  }
  return "safe";
};

/**
 * 히스테리시스를 적용한 등급 판정.
 *
 * 1. 승격(더 높은 등급 진입)은 항상 기본 임계값으로 판정한다. 유지/해제만
 *    넓힌 임계값(`releaseRatio`)으로 판정한다 — 진입선과 해제선이 달라지므로
 *    CPA가 499↔501 m를 오갈 때 경보가 켜졌다 꺼지지 않는다. 넓힌 값을
 *    승격에도 쓰면 warning 중인 선박이 650 m(문서상 500 m)에서 danger로
 *    승격되고, danger 진입선과 해제선이 겹쳐 경계에서 플래핑한다.
 * 2. 승격은 즉시, 강등은 `downgradeDwellMs` 동안 연속 유지될 때만 반영한다.
 *
 * 순수 함수다 — 현재 시각을 인자로 받으므로 테스트에서 시간을 직접 전진시킬 수 있다.
 *
 * Grade with hysteresis. Upgrades are always judged against the base
 * thresholds; only holding/releasing the current grade uses the widened
 * thresholds (using the widened value for upgrades too would promote a
 * warning-grade vessel to danger at 650 m instead of the documented 500 m,
 * and would make the danger enter/release lines coincide). Upgrades apply
 * immediately; downgrades need a sustained dwell. Pure function — `now` is
 * injected so tests can advance time by hand.
 */
export const gradeRisk = (
  prev: RiskGradeState,
  cpaDistanceM: number,
  tcpaS: number,
  now: number,
  th: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
): RiskGradeState => {
  const heldRank = severityRank[prev.severity];

  const enter = rawSeverity(cpaDistanceM, tcpaS, th);
  if (severityRank[enter] > heldRank) {
    return { severity: enter, pendingSince: null };
  }

  const widen = prev.severity === "safe" ? 1 : th.releaseRatio;
  const hold = rawSeverity(cpaDistanceM, tcpaS, th, widen);
  if (severityRank[hold] >= heldRank) {
    return prev.pendingSince === null
      ? prev
      : { severity: prev.severity, pendingSince: null };
  }

  const since = prev.pendingSince ?? now;
  if (now - since >= th.downgradeDwellMs) {
    return { severity: hold, pendingSince: null };
  }
  return { severity: prev.severity, pendingSince: since };
};
