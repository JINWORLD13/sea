import type { ReactElement } from "react";
import ShipMap from "../components/map/ShipMap";
import { useTranslation } from "react-i18next";
import { useShipStore } from "../store/useShipStore";

const LiveMap = (): ReactElement => {
  const translation = useTranslation();
  const t = translation.t;
  const streamStatus = useShipStore((state) => state.streamStatus);

  /**
   * [KO]
   * <div(컨테이너)>
   *  <div(오버레이 박스)>
   *    <h2>제목</h2>
   *    <p>스트림 상태 (connecting/live/reconnecting/error)</p>
   *  </div>
   *  <ShipMap />
   * </div>
   */
  /**
   * [JA]
   *  </div>
   *  <ShipMap />
   * </div>
   */
  /**
   * [EN]
   * <div(Container)>
   *  <div(Overlay Box)>
   *    <h2>Title</h2>
   *    <p>Stream Status (connecting/live/reconnecting/error)</p>
   *  </div>
   *  <ShipMap />
   * </div>
   */

  // 스트림 상태에 따른 표시 속성: connecting/reconnecting=호박색, live=에메랄드, error=로즈, idle=슬레이트
  // Display attributes per stream state: connecting/reconnecting=amber, live=emerald, error=rose, idle=slate.
  const resolveStreamIndicator = (): {
    dotClass: string;
    textClass: string;
    label: string;
  } => {
    switch (streamStatus.state) {
      case "connecting":
        return {
          dotClass: "bg-amber-400 animate-pulse",
          textClass: "text-amber-300",
          label: t("connectingAis"),
        };
      case "live":
        return {
          dotClass: "bg-emerald-500 animate-ping",
          textClass: "text-slate-400",
          label: t("streamingActive"),
        };
      case "reconnecting":
        return {
          dotClass: "bg-amber-400 animate-pulse",
          textClass: "text-amber-300",
          label:
            t("streamReconnectingDetail", "Reconnecting to live feed...") +
            (streamStatus.reconnectAttempts > 0
              ? ` (${streamStatus.reconnectAttempts})`
              : ""),
        };
      case "error":
        return {
          dotClass: "bg-rose-500",
          textClass: "text-rose-300",
          label: t("streamErrorDetail", "Live feed unavailable"),
        };
      default:
        return {
          dotClass: "bg-slate-500",
          textClass: "text-slate-400",
          label: t("streamIdleDetail", "Stream idle"),
        };
    }
  };

  const indicator = resolveStreamIndicator();

  // isolate: 헤더 드롭다운이 Leaflet 페인 위에 오도록 스태킹 컨텍스트를 격리한다.
  // isolate: contain Leaflet pane z-indexes so header dropdowns stack above the map.
  const containerStyle: string =
    "h-[calc(100vh-8rem)] bg-[#0b0e14] rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative isolate";
  const overlayStyle: string =
    "absolute top-6 right-6 z-[1000] bg-black/60 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-white/10 min-w-[200px] max-w-[280px]";

  const resultMarkup: ReactElement = (
    <div className={containerStyle}>
      <title>{t("navLiveMap")} - {t("appName")}</title>
      <div className={overlayStyle}>
        <h2 className="font-black text-white uppercase tracking-widest text-lg mb-1">
          {t("mapTracking")}
        </h2>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full shrink-0 ${indicator.dotClass}`}
          />
          <p
            className={`text-xs font-bold uppercase tracking-tighter ${indicator.textClass}`}
          >
            {indicator.label}
          </p>
        </div>
        {streamStatus.state === "error" && streamStatus.error !== null && (
          <p className="text-[10px] text-rose-400/70 mt-1 break-words">
            {streamStatus.error}
          </p>
        )}
      </div>
      <ShipMap />
    </div>
  );

  return resultMarkup;
};

export default LiveMap;
