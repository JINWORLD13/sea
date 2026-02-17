// 알림 목록: 선박의 위험 경보를 리스트로 표시합니다.
// アラートリスト：船舶の危険警告をリスト形式で表示します。
// Alert List: Displays a list of ship danger alerts.
import { AlertTriangle, Info, XCircle, CheckCircle } from "lucide-react";
import { useShipStore, selectDisplayShips } from "../../store/useShipStore";
import { useTranslation } from "react-i18next";

const Alerts = () => {
  // 스토어에서 알림 데이터 가져오기
  // ストアからアラートデータを取得
  // Get alert data from the store.
  const shipStore = useShipStore();
  const ships = useShipStore(selectDisplayShips);
  const selectedShipMmsi = shipStore.selectedShipMmsi;
  const ackAlert = shipStore.ackAlert;

  const selectedShip = selectedShipMmsi ? ships[selectedShipMmsi] : null;
  const alerts = selectedShip?.alerts || [];

  const translation = useTranslation();
  const t = translation.t;
  const i18n = translation.i18n;

  // 활성 알림이 없을 때의 화면
  // アクティブなアラートがない時の画面
  // Screen when there are no active alerts.
  if (alerts.length === 0) {
    const noAlertContent = (
      <div className="glass-card p-6 rounded-2xl flex items-center gap-4 border-l-4 border-emerald-500">
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

  // 알림 확인 처리 함수
  // アラートの確認処理関数
  // Function to handle alert dismissal.
  const handleDismiss = (id: string) => {
    if (selectedShipMmsi) {
      ackAlert(selectedShipMmsi, id);
    }
  };

  // 번역 메시지 획득
  // 翻訳メッセージの取得
  // Obtain translated message.
  const getTranslatedMessage = (msg: string) => {
    const exists = i18n.exists(msg);
    if (exists) {
      const transMsg = t(msg);
      return transMsg;
    } else {
      return msg;
    }
  };

  const resultMarkup = (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col h-[300px]">
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-red-500/5">
        <h3 className="text-sm font-black text-red-400 flex items-center gap-2 uppercase tracking-widest">
          <AlertTriangle size={16} className="animate-pulse" />
          {t("activeAlerts")} ({alerts.length})
        </h3>
      </div>

      <div className="divide-y divide-white/5 overflow-y-auto flex-1 h-full">
        {alerts.map((alert) => {
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
              className={`p-4 flex items-start justify-between hover:bg-white/5 transition-all ${severityClass}`}
            >
              <div className="flex gap-4">
                <div className={`mt-1 p-2 rounded-xl border ${iconClass}`}>
                  {alert.severity === "high" ? (
                    <XCircle size={18} />
                  ) : (
                    <Info size={18} />
                  )}
                </div>
                <div>
                  <p className={messageClass}>
                    {getTranslatedMessage(alert.message)}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono uppercase">
                    {new Date(alert.timestamp).toLocaleTimeString()} •{" "}
                    <span className={severityTextClass}>
                      {alert.severity.toUpperCase()}
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  handleDismiss(alert.id);
                }}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white px-3 py-1.5 border border-white/5 rounded-lg hover:bg-white/10 transition-all"
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
