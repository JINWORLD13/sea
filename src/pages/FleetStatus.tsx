// 함대 상태 페이지: 선박 리스트와 주요 상태를 보여줍니다.
// 艦隊ステータスページ：船舶リストと主要ステータスを表示します。
// Fleet Status Page: Displays ship list and key status.
import { type ReactElement, type FC } from "react";
import { Ship, Anchor, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShipStore, selectDisplayShips } from "../store/useShipStore";

const FleetStatus: FC = (): ReactElement => {
  const { t } = useTranslation();
  const ships = useShipStore(selectDisplayShips);

  const shipList = Object.values(ships);
  const totalVessels = shipList.length;
  const activeVessels = shipList.filter((s) => s.speed > 0.5).length;
  const mooredVessels = totalVessels - activeVessels;
  const criticalAlerts = shipList.reduce((acc, s) => acc + s.alerts.length, 0);

  /**
   * [KO]
   * <div(메인 컨테이너)>
   *  <div(헤더 섹션)>
   *  <div(요약 카드 그리드)>
   *  <div(선박 목록 테이블)>
   * </div>
   */
  /**
   * [JA]
   * <div(メインコンテナ)>
   *  <div(ヘッダーセクション)>
   *  <div(要約カードグリッド)>
   *  <div(船舶リストテーブル)>
   * </div>
   */
  /**
   * [EN]
   * <div(Main Container)>
   *  <div(Header Section)>
   *  <div(Summary Card Grid)>
   *  <div(Vessel List Table)>
   * </div>
   */
  const resultMarkup: ReactElement = (
    <div className="space-y-6">
      <title>{t("fleetStatusTitle")} - {t("appName")}</title>
      <div className="flex justify-between items-end">
        <h2 className="text-2xl font-bold text-slate-800">
          {t("fleetStatusTitle")}
        </h2>
        <div className="text-sm text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 italic">
          {t("realtimeSyncActive")}
        </div>
      </div>

      {/* 
          요약 카드 섹션
          要約カードセクション 
          Summary Card Section
      */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-xl">
            <Ship size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {t("totalVessels")}
            </p>
            <p className="text-3xl font-black text-slate-800">{totalVessels}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
            <Anchor size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {t("activeMoored")}
            </p>
            <div className="flex items-baseline gap-1">
              <p className="text-3xl font-black text-slate-800">
                {activeVessels}
              </p>
              <p className="text-slate-300 font-medium">/</p>
              <p className="text-xl font-bold text-slate-500">
                {mooredVessels}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 transition-transform hover:scale-[1.02]">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
              {t("activeAlerts")}
            </p>
            <p className="text-3xl font-black text-slate-800">
              {criticalAlerts}
            </p>
          </div>
        </div>
      </div>

      {/* 
          선박 목록 테이블
          船舶リストテーブル
          Vessel List Table 
      */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50">
          <h3 className="font-bold text-slate-700">{t("vesselDirectory")}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                <th className="px-6 py-4">{t("mmsi")}</th>
                <th className="px-6 py-4">{t("vesselName")}</th>
                <th className="px-6 py-4">{t("vesselType")}</th>
                <th className="px-6 py-4 text-center">{t("status")}</th>
                <th className="px-6 py-4 text-right">{t("fuel")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {shipList.map((ship) => {
                const isActive = ship.speed > 0.5;
                return (
                  <tr
                    key={ship.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4 text-sm font-mono text-slate-400 group-hover:text-indigo-400">
                      {ship.id}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">
                      {ship.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                        {ship.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                          isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}
                        />
                        {isActive ? t("active") : t("moored")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-bold text-slate-600">
                          {ship.fuel.toFixed(1)}%
                        </span>
                        <div className="w-20 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              ship.fuel > 70
                                ? "bg-emerald-400"
                                : ship.fuel > 30
                                  ? "bg-amber-400"
                                  : "bg-rose-400"
                            }`}
                            style={{ width: `${ship.fuel}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return resultMarkup;
};

export default FleetStatus;
