// 알림 목록: 전역 알림 피드(지오펜스 진입 / CPA 충돌 위험)를 표시합니다.
// 선박 선택 여부와 무관하게 관제 구역 전체의 알림을 보여줍니다.
// アラートリスト：グローバルアラートフィード（ジオフェンス進入／CPA衝突リスク）を表示します。
// 船舶の選択有無に関係なく、管制海域全体のアラートを表示します。
// Alert List: Renders the global alert feed (geofence entries / CPA collision
// risk) for the whole coverage area — works with no vessel selected.
import { useEffect, useState } from "react";
import { AlertTriangle, Info, XCircle, CheckCircle } from "lucide-react";
import { useShipStore } from "../../store/useShipStore";
import type { AlertEntry } from "../../store/useShipStore";
import { useTranslation } from "react-i18next";

interface AlertsProps {
  // 안전 모드에서 패널을 강조 표시한다.
  // 安全モードでパネルを強調表示する。
  // Highlight the panel while safety mode is active.
  highlighted?: boolean;
}

// 발생 후 경과 시간을 간결하게 표기 ("12s", "3m", "2h", "1d").
// 発生後の経過時間を簡潔に表記（"12s"、"3m"、"2h"、"1d"）。
// Compact age since the alert fired ("12s", "3m", "2h", "1d").
const formatAge = (timestamp: number): string => {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const Alerts = ({ highlighted = false }: AlertsProps) => {
  // 스토어의 전역 알림 피드 (최신순, 최대 100건).
  // ストアのグローバルアラートフィード（新しい順、最大100件）。
  // Global alert feed from the store (newest first, capped at 100).
  const alertFeed = useShipStore((state) => state.alertFeed);
  const ackFeedAlert = useShipStore((state) => state.ackFeedAlert);

  const translation = useTranslation();
  const t = translation.t;
  const i18n = translation.i18n;

  // 경과 시간 표기가 오래되지 않도록 10초마다 리렌더한다.
  // 経過時間表示が古くならないよう10秒ごとに再レンダーする。
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

  const highlightClass = highlighted
    ? " ring-2 ring-red-500/40 shadow-[0_0_25px_rgba(239,68,68,0.15)]"
    : "";

  // 활성 알림이 없을 때의 화면
  // アクティブなアラートがない時の画面
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

  // 번역 메시지 획득 (피드 메시지는 영어 폴백 텍스트이거나 i18n 키일 수 있음)
  // 翻訳メッセージの取得（フィードメッセージは英語フォールバックまたはi18nキー）
  // Obtain translated message (feed messages are English fallback text, or an
  // i18n key when one exists).
  const getTranslatedMessage = (msg: string) => {
    const exists = i18n.exists(msg);
    if (exists) {
      const transMsg = t(msg);
      return transMsg;
    } else {
      return msg;
    }
  };

  // 알림 종류 라벨 (지오펜스 / CPA).
  // アラート種別ラベル（ジオフェンス／CPA）。
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
                    {getTranslatedMessage(alert.message)}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono uppercase">
                    {getKindLabel(alert.kind)} • {formatAge(alert.timestamp)} •{" "}
                    <span className={severityTextClass}>
                      {alert.severity.toUpperCase()}
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
