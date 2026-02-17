import type { ReactElement } from "react";
import ShipMap from "../components/map/ShipMap";
import { useTranslation } from "react-i18next";

const LiveMap = (): ReactElement => {
  const translation = useTranslation();
  const t = translation.t;

  /**
   * [KO]
   * <div(컨테이너)>
   *  <div(오버레이 박스)>
   *    <h2>제목</h2>
   *    <p>상태 정보</p>
   *  </div>
   *  <ShipMap />
   * </div>
   */
  /**
   * [JA]
   * <div(コンテナ)>
   *  <div(オーバーレイボックス)>
   *    <h2>タイトル</h2>
   *    <p>ステータス情報</p>
   *  </div>
   *  <ShipMap />
   * </div>
   */
  /**
   * [EN]
   * <div(Container)>
   *  <div(Overlay Box)>
   *    <h2>Title</h2>
   *    <p>Status Information</p>
   *  </div>
   *  <ShipMap />
   * </div>
   */

  const containerStyle: string =
    "h-[calc(100vh-8rem)] bg-[#0b0e14] rounded-2xl shadow-2xl border border-white/10 overflow-hidden relative";
  const overlayStyle: string =
    "absolute top-6 right-6 z-[1000] bg-black/60 backdrop-blur-xl p-5 rounded-2xl shadow-2xl border border-white/10 min-w-[200px]";

  const resultMarkup: ReactElement = (
    <div className={containerStyle}>
      <title>{t("navLiveMap")} - {t("appName")}</title>
      <div className={overlayStyle}>
        <h2 className="font-black text-white uppercase tracking-widest text-lg mb-1">
          {t("mapTracking")}
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-tighter">
            {t("globalCoverageActive")}
          </p>
        </div>
      </div>
      <ShipMap />
    </div>
  );

  return resultMarkup;
};

export default LiveMap;
