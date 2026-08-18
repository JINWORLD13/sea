// 알림 피드 표기 헬퍼 — 알림을 그리는 모든 표면(대시보드 Alerts 패널,
// 헤더 종 드롭다운)이 같은 번역 경로를 쓰도록 한 곳에 모은다. 각자 로컬
// 헬퍼를 두면 같은 알림이 패널마다 다른 언어/형식으로 보인다.
// Alert-feed presentation helpers — shared by every surface that renders
// alerts (dashboard Alerts panel, header bell dropdown) so the same entry
// never shows up differently localized between panels.
import type { TFunction, i18n as I18nInstance } from "i18next";
import type { AlertEntry } from "../store/shipTypes";

// 스토어는 영어 원문(예: "Entered restricted fishery zone")을 저장하고,
// 그 원문이 그대로 i18n 키로도 등록돼 있다(translations.ts 참조).
// 키가 있으면 번역하고, 없으면(동적 CPA 문구 등) 원문을 그대로 보여준다.
// The store keeps the English source text (e.g. "Entered restricted fishery
// zone"), which doubles as an i18n key (see translations.ts). Translate when
// the key exists; dynamic messages (CPA figures) fall through verbatim.
export const translateAlertMessage = (
  i18nInstance: I18nInstance,
  t: TFunction,
  message: string,
): string => (i18nInstance.exists(message) ? t(message) : message);

// 발생 후 경과 시간을 현재 언어로 표기 ("12초 전" / "12s ago").
// Localized age since the alert fired ("12s ago" and friends).
export const formatAlertAge = (t: TFunction, timestamp: number): string => {
  const elapsedSec = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (elapsedSec < 5) return t("alertAgeJustNow", "just now");
  if (elapsedSec < 60) {
    return t("alertAgeSeconds", "{{value}}s ago", { value: elapsedSec });
  }
  const minutes = Math.floor(elapsedSec / 60);
  if (minutes < 60) {
    return t("alertAgeMinutes", "{{value}}m ago", { value: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t("alertAgeHours", "{{value}}h ago", { value: hours });
  }
  // 알림 피드는 확인/삭제 전까지 만료되지 않는다. 상시 가동되는 관제 화면에서
  // 며칠 묵은 항목이 "96시간 전"으로 찍히면 경과를 눈으로 가늠할 수 없다.
  // The alert feed never expires on its own — entries persist until
  // acknowledged — so on an always-on console a days-old item rendered as
  // "96h ago" forces the reader to divide by 24 to judge staleness.
  return t("alertAgeDays", "{{value}}d ago", { value: Math.floor(hours / 24) });
};

// 심각도 라벨 (severityHigh/Medium/Low 키는 en/ko/ja 모두 존재).
// Severity label (the severity* keys exist in all three languages).
export const formatAlertSeverity = (
  t: TFunction,
  severity: AlertEntry["severity"],
): string =>
  severity === "high"
    ? t("severityHigh", "High")
    : severity === "medium"
      ? t("severityMedium", "Medium")
      : t("severityLow", "Low");
