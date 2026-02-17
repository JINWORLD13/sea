// 분석 페이지: 선단 전체의 연료 효율 및 트렌드를 시각화합니다.
// 分析ページ：艦隊全体の燃料効率とトレンドを可視化します。
// Analytics Page: Visualizes fuel efficiency and trends across the fleet.
import { type ReactElement, type FC } from "react";
import { BarChart, TrendingUp, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShipStore, selectDisplayShips } from "../store/useShipStore";

const Analytics: FC = (): ReactElement => {
  const { t } = useTranslation();
  const ships = useShipStore(selectDisplayShips);

  const shipList = Object.values(ships);

  // 평균 연료 잔량 계산
  // 平均燃料残量の計算
  // Calculate average fuel level.
  const avgFuel =
    shipList.length > 0
      ? shipList.reduce((acc, s) => acc + s.fuel, 0) / shipList.length
      : 0;

  // 운영 효율 점수 (데모용 고정값)
  // 運用効率スコア（デモ用固定値）
  // Operational efficiency score (fixed value for demo).
  const avgEfficiency = 88.4;

  /**
   * [KO]
   * <div(컨테이너)>
   *  <div(헤더 섹션)>
   *  <div(요약 지표 그리드)>
   *  <div(상세 차트 그리드)>
   * </div>
   */
  /**
   * [JA]
   * <div(コンテナ)>
   *  <div(ヘッダーセクション)>
   *  <div(要約指標グリッド)>
   *  <div(詳細チャートグリッド)>
   * </div>
   */
  /**
   * [EN]
   * <div(Container)>
   *  <div(Header Section)>
   *  <div(Summary Metrics Grid)>
   *  <div(Detailed Chart Grid)>
   * </div>
   */
  const analyticsMarkup: ReactElement = (
    <div className="space-y-6">
      <title>{t("analyticsTitle")} - {t("appName")}</title>
      <div className="flex justify-between items-end">
        <h2 className="text-2xl font-bold text-slate-800">
          {t("analyticsTitle")}
        </h2>
        <div className="text-xs text-indigo-500 font-bold bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
          {t("liveDataFeed")}
        </div>
      </div>

      {/* 
          요약 지표 카드 섹션
          要約指標カードセクション
          Summary Metrics Card Section 
      */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Zap size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              {t("avgFleetFuel")}
            </h4>
          </div>
          <p className="text-3xl font-black text-slate-800">
            {avgFuel.toFixed(1)}%
          </p>
          <div className="mt-4 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500"
              style={{ width: `${avgFuel}%` }}
            />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              {t("operationalEfficiency")}
            </h4>
          </div>
          <p className="text-3xl font-black text-slate-800">{avgEfficiency}%</p>
          <p className="text-xs text-emerald-500 font-bold mt-1">
            {t("fromYesterday")}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <BarChart size={20} />
            </div>
            <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              {t("estCo2Reduction")}
            </h4>
          </div>
          <p className="text-3xl font-black text-slate-800">14.2t</p>
          <p className="text-xs text-slate-400 mt-1">
            {t("totalFleetSavings")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 
            연료 소비 트렌드 차트 (막대 그래프)
            燃料消費トレンドチャート（棒グラフ）
            Fuel Consumption Trend Chart (Bar Graph)
        */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
          <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
            <Zap size={18} className="text-indigo-500" />
            {t("fuelUsage")} Trend
          </h3>
          <div className="h-64 flex items-end justify-between gap-1 px-4">
            {shipList.map((ship, idx) => (
              <div
                key={ship.id}
                className="flex-1 flex flex-col items-center gap-2 group relative"
              >
                <div
                  className="w-full bg-indigo-400/20 group-hover:bg-indigo-500 transition-all rounded-t-lg relative"
                  style={{ height: `${ship.fuel}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap">
                    {ship.name}: {ship.fuel.toFixed(1)}%
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-300 truncate w-full text-center">
                  V{idx + 1}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-50 flex justify-between text-xs text-slate-400">
            <span>{t("currentFleetSnapshots")}</span>
            <span className="italic">{t("dataUpdatedEvery5s")}</span>
          </div>
        </div>

        {/* 
            운영 효율 분포 (프로그레스 바)
            運用効率分布（プログレスバー）
            Efficiency distribution (Progress bars)
        */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[400px]">
          <h3 className="font-bold text-slate-700 mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-500" />
            {t("efficiency")} distribution
          </h3>
          <div className="space-y-4">
            {shipList.slice(0, 6).map((ship) => {
              const eff =
                (ship.historicalData?.[ship.historicalData.length - 1]
                  ?.efficiency || 0.85) * 100;
              return (
                <div key={ship.id} className="space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">{ship.name}</span>
                    <span className="text-emerald-500">{eff.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-1000"
                      style={{ width: `${eff}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-12 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              {t("operationalEfficiencyDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return analyticsMarkup;
};

export default Analytics;
