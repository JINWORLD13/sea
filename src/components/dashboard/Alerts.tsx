// 알림 목록: 전역 알림 피드(지오펜스 진입 / CPA 충돌 위험)를 표시합니다.
// 선박 선택 여부와 무관하게 관제 구역 전체의 알림을 보여줍니다.
// Alert List: Renders the global alert feed (geofence entries / CPA collision
// risk) for the whole coverage area — works with no vessel selected.
import { useEffect, useState } from "react";
import { AlertTriangle, Info, XCircle, CheckCircle } from "lucide-react";
import { useShipStore } from "../../store/useShipStore";
import type { AlertEntry } from "../../store/useShipStore";
import { useTranslation } from "react-i18next";
import {
  formatAlertAge,
  formatAlertSeverity,
  translateAlertMessage,
} from "../../utils/alertText";

interface AlertsProps {
  // 안전 모드에서 패널을 강조 표시한다.
  // Highlight the panel while safety mode is active.
  highlighted?: boolean;
}

const Alerts = ({ highlighted = false }: AlertsProps) => {
  // 스토어의 전역 알림 피드 (최신순, 최대 100건).
  // Global alert feed from the store (newest first, capped at 100).
  const alertFeed = useShipStore((state) => state.alertFeed);
  const ackFeedAlert = useShipStore((state) => state.ackFeedAlert);

  const translation = useTranslation();
  const t = translation.t;
  const i18n = translation.i18n;

  // 경과 시간 표기가 오래되지 않도록 10초마다 리렌더한다.
  // Re-render every 10s so displayed ages stay fresh.
  const [, setAgeTick] = useState(0);
  useEffect(() => {
    if (alertFeed.length === 0) return;
    const timerId = window.setInterval(
      () => setAgeTick((tick) => tick + 1),
      10_000,
    );
    return () => window.clearInterval(timerId);
  }, [alertFeed.length]);

  // 경보가 실제로 있을 때만 빨간 링을 두른다. 안전 모드는 아무 필터도 걸지
  // 않은 기본 상태이기도 해서, 링을 모드에만 걸면 갓 켠 화면의 "이상 없음"
  // 카드가 상시 경보색을 두르게 된다 — 관제 화면에서 가장 피해야 할 신호다.
  // Ring only when there are alerts to ring about. Safety mode is also the
  // resting state (no filters applied), so keying the ring off the mode alone
  // would wrap the "all clear" card of a freshly loaded console in permanent
  // alarm red — the exact false signal an alerting console must avoid.
  const highlightClass =
    highlighted && alertFeed.length > 0
      ? " ring-2 ring-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.15)]"
      : "";

  // 활성 알림이 없을 때의 화면
  // Screen when there are no active alerts.
  if (alertFeed.length === 0) {
    const noAlertContent = (
      <div
        className={
          "glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-emerald-500" +
          highlightClass
        }
      >
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
          <CheckCircle className="text-emerald-400" size={24} />
        </div>
        <div>
          <h3 className="font-black text-white text-sm uppercase tracking-widest">
            {t("noAlerts")}
          </h3>
          <p className="text-xs text-slate-500 uppercase tracking-tight">
            {t("noAlertsDesc")}
          </p>
        </div>
      </div>
    );
    return noAlertContent;
  }

  // 알림 종류 라벨 (지오펜스 / CPA).
  // Alert kind label (geofence / CPA).
  const getKindLabel = (kind: AlertEntry["kind"]): string =>
    kind === "cpa"
      ? t("alertKindCpa", "CPA")
      : t("alertKindGeofence", "Geofence");

  const resultMarkup = (
    <div
      className={
        "glass-card rounded-2xl overflow-hidden flex flex-col h-[300px]" +
        highlightClass
      }
    >
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-red-500/5">
        <h3 className="text-sm font-black text-red-400 flex items-center gap-2 uppercase tracking-widest">
          <AlertTriangle size={16} className="animate-pulse" />
          {t("activeAlerts")} ({alertFeed.length})
        </h3>
      </div>

      <div className="divide-y divide-white/5 overflow-y-auto flex-1 h-full">
        {alertFeed.map((alert) => {
          let severityClass = "";
          if (alert.severity === "high") {
            severityClass = "bg-red-500/5 border-l-4 border-red-500";
          }

          let iconClass = "";
          if (alert.severity === "high") {
            iconClass = "bg-red-500/20 text-red-400 border-red-500/30";
          } else if (alert.severity === "medium") {
            iconClass = "bg-amber-500/20 text-amber-400 border-amber-500/30";
          } else {
            iconClass = "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
          }

          let messageClass = "text-sm font-bold leading-tight mb-1 ";
          if (alert.severity === "high") {
            messageClass = messageClass + "text-red-400";
          } else {
            messageClass = messageClass + "text-white";
          }

          let severityTextClass = "";
          if (alert.severity === "high") {
            severityTextClass = "text-red-500/70";
          } else {
            severityTextClass = "text-indigo-400/70";
          }

          return (
            <div
              key={alert.id}
              className={`p-4 flex items-start justify-between gap-2 hover:bg-white/5 transition-all ${severityClass}`}
            >
              <div className="flex gap-4 min-w-0">
                <div
                  className={`mt-1 p-2 rounded-xl border shrink-0 ${iconClass}`}
                >
                  {alert.severity === "high" ? (
                    <XCircle size={18} />
                  ) : (
                    <Info size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-indigo-300 uppercase tracking-wider truncate">
                    {alert.shipName}
                  </p>
                  <p className={messageClass}>
                    {translateAlertMessage(i18n, t, alert.message)}
                  </p>
                  {/*
                    경과 시간·심각도도 헤더 종 드롭다운과 같은 i18n 경로를
                    쓴다 — 같은 알림이 패널마다 다른 언어로 보이면 안 된다.
                    Age and severity share the header dropdown's i18n path —
                    the same alert must not localize differently per panel.
                  */}
                  <p className="text-[11px] text-slate-500 font-mono uppercase">
                    {getKindLabel(alert.kind)} • {formatAlertAge(t, alert.timestamp)} •{" "}
                    <span className={severityTextClass}>
                      {formatAlertSeverity(t, alert.severity)}
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  ackFeedAlert(alert.id);
                }}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white px-3 py-1.5 border border-white/5 rounded-lg hover:bg-white/10 transition-all shrink-0"
              >
                {t("dismiss")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return resultMarkup;
};

export default Alerts;
