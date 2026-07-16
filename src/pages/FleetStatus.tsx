// 함대 상태 페이지: 실시간 추적 중인 선박 디렉토리와 주요 상태를 보여줍니다.
// 艦隊ステータスページ:リアルタイム追跡中の船舶ディレクトリと主要ステータスを表示します。
// Fleet Status Page: Live directory of tracked vessels with their key status.
import { useMemo } from "react";
import type { FC, ReactElement } from "react";
import { AlertTriangle, Anchor, Ship } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useShipSnapshot } from "../hooks/useShipSnapshot";
import { useShipStore } from "../store/useShipStore";
import type { AppSettings, ShipCategory } from "../store/useShipStore";
import {
  formatEta,
  getCategoryColor,
  getCategoryLabelKey,
  isStationaryStatus,
} from "../utils/aisTypes";

// i18n 키가 번역되기 전에도 읽을 수 있게 하는 영어 기본값(수집 패스가 키를 채운다).
// i18nキーが翻訳される前でも読めるようにする英語デフォルト(収集パスがキーを埋める)。
// English fallbacks so type labels stay readable before the i18n pass fills the keys in.
const CATEGORY_LABEL_FALLBACK: Record<ShipCategory, string> = {
  cargo: "Cargo",
  tanker: "Tanker",
  passenger: "Passenger",
  highspeed: "High-speed craft",
  fishing: "Fishing",
  tug: "Tug & pilot",
  pleasure: "Pleasure craft",
  special: "Special craft",
  other: "Other",
  unknown: "Unknown",
  aton: "Aid to navigation",
  base: "Base station",
};

// 대형 스냅샷에서도 렌더링이 가볍도록 표 행 수를 제한한다(절단 시 정직하게 고지).
// 大規模スナップショットでも描画が軽いように表の行数を制限する(切り捨て時は正直に告知)。
// Cap table rows so large snapshots stay light to render (truncation is disclosed honestly).
const MAX_TABLE_ROWS = 200;

const formatSpeed = (sog: number, unit: AppSettings["speedUnit"]): string =>
  unit === "kmh" ? `${(sog * 1.852).toFixed(1)} km/h` : `${sog.toFixed(1)} kn`;

const FleetStatus: FC = (): ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const ships = useShipSnapshot({ delayMs: 1000 });
  const alertFeed = useShipStore((state) => state.alertFeed);
  const settings = useShipStore((state) => state.settings);
  const selectShip = useShipStore((state) => state.selectShip);
  const streamStatus = useShipStore((state) => state.streamStatus);

  // ── 디렉토리는 실제 선박(kind "vessel")만 포함하고 이름순으로 정렬한다 ──
  // ── ディレクトリは実船舶(kind "vessel")のみ含み、名前順に整列する ──
  // ── The directory lists real vessels only (kind "vessel"), sorted by name ──
  const { vessels, activeCount, mooredCount } = useMemo(() => {
    const list = Object.values(ships).filter((ship) => ship.kind === "vessel");
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    let moored = 0;
    for (const vessel of list) {
      if (isStationaryStatus(vessel.navStatus)) moored += 1;
    }
    return {
      vessels: list,
      activeCount: list.length - moored,
      mooredCount: moored,
    };
  }, [ships]);

  const visibleVessels = vessels.slice(0, MAX_TABLE_ROWS);

  const handleOpenShip = (mmsi: string): void => {
    selectShip(mmsi);
    navigate("/dashboard");
  };

  // ── 실제 스트림 상태를 반영하는 헤더 칩(항상 초록색인 가짜 칩 금지) ──
  // ── 実際のストリーム状態を反映するヘッダーチップ(常時緑の偽チップ禁止) ──
  // ── Header chip reflecting the REAL stream state (no perpetually green fake) ──
  const streamChip = ((): { label: string; className: string } => {
    switch (streamStatus.state) {
      case "live":
        return {
          label: t("realtimeSyncActive"),
          className: "text-emerald-600 bg-emerald-50 border-emerald-100",
        };
      case "reconnecting":
        return {
          label: t("streamReconnecting", "Reconnecting…"),
          className: "text-amber-600 bg-amber-50 border-amber-100",
        };
      case "connecting":
        return {
          label: t("streamConnecting", "Connecting…"),
          className: "text-sky-600 bg-sky-50 border-sky-100",
        };
      case "error":
        return {
          label: t("streamError", "Live stream error"),
          className: "text-rose-600 bg-rose-50 border-rose-100",
        };
      default:
        return {
          label: t("streamIdle", "Stream idle"),
          className: "text-slate-500 bg-slate-50 border-slate-100",
        };
    }
  })();

  /**
   * [KO]
   * <div(메인 컨테이너)>
   *  <div(헤더 섹션: 제목 + 스트림 상태 칩)>
   *  <div(요약 카드 그리드)>
   *  <div(선박 목록 테이블)>
   * </div>
   */
  /**
   * [JA]
   * <div(メインコンテナ)>
   *  <div(ヘッダーセクション:タイトル + ストリーム状態チップ)>
   *  <div(要約カードグリッド)>
   *  <div(船舶リストテーブル)>
   * </div>
   */
  /**
   * [EN]
   * <div(Main Container)>
   *  <div(Header Section: title + stream status chip)>
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
        <div
          className={`text-sm px-3 py-1 rounded-full border font-medium ${streamChip.className}`}
        >
          {streamChip.label}
        </div>
      </div>

      {/*
          요약 카드 섹션 — 실측치(항해상태 기반 운항/정박, 전역 경보 피드).
          要約カードセクション — 実測値(航行状態ベースの運航/停泊、グローバル警報フィード)。
          Summary Card Section — measured values (nav-status based active/moored,
          global alert feed).
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
            <p className="text-3xl font-black text-slate-800 tabular-nums">
              {vessels.length}
            </p>
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
              <p className="text-3xl font-black text-slate-800 tabular-nums">
                {activeCount}
              </p>
              <p className="text-slate-300 font-medium">/</p>
              <p className="text-xl font-bold text-slate-500 tabular-nums">
                {mooredCount}
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
            <p className="text-3xl font-black text-slate-800 tabular-nums">
              {alertFeed.length}
            </p>
          </div>
        </div>
      </div>

      {/*
          선박 목록 테이블 — 행 클릭 시 해당 선박 선택 후 대시보드로 이동.
          船舶リストテーブル — 行クリックで当該船舶を選択しダッシュボードへ移動。
          Vessel List Table — clicking a row selects the ship and opens the dashboard.
      */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-700">{t("vesselDirectory")}</h3>
          {vessels.length > visibleVessels.length && (
            <p className="text-[11px] text-slate-400">
              {t(
                "showingVessels",
                "Showing {{shown}} of {{total}} vessels",
                { shown: visibleVessels.length, total: vessels.length },
              )}
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                <th className="px-6 py-4">{t("mmsi")}</th>
                <th className="px-6 py-4">{t("vesselName")}</th>
                <th className="px-6 py-4">{t("vesselType")}</th>
                <th className="px-6 py-4 text-center">{t("status")}</th>
                <th className="px-6 py-4">{t("destination")}</th>
                <th className="px-6 py-4">{t("eta", "ETA")}</th>
                <th className="px-6 py-4 text-right">{t("speed", "Speed")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleVessels.length === 0 ? (
                // 정직한 빈 상태: 추적 중인 선박이 없으면 그대로 알린다.
                // 正直な空状態:追跡中の船舶がなければそのまま伝える。
                // Honest empty state — say so when nothing is tracked yet.
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-xs font-bold uppercase tracking-widest text-slate-400"
                  >
                    {t(
                      "noVesselsTracked",
                      "No vessels are currently tracked — waiting for live AIS data",
                    )}
                  </td>
                </tr>
              ) : (
                visibleVessels.map((ship) => {
                  // 항해상태(NavigationalStatus) 기준: 정박/계류/좌초 → Moored, 그 외 → Active.
                  // 航行状態(NavigationalStatus)基準:錨泊/係留/座礁 → Moored、その他 → Active。
                  // Nav-status driven: anchored/moored/aground → Moored, else Active.
                  const stationary = isStationaryStatus(ship.navStatus);
                  const etaText = formatEta(ship.eta);
                  return (
                    <tr
                      key={ship.id}
                      tabIndex={0}
                      onClick={() => handleOpenShip(ship.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleOpenShip(ship.id);
                        }
                      }}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer focus:outline-none focus:bg-indigo-50/50"
                    >
                      <td className="px-6 py-4 text-sm font-mono text-slate-400 group-hover:text-indigo-400">
                        {ship.id}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">
                        {ship.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-medium">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: getCategoryColor(ship.category),
                            }}
                            aria-hidden="true"
                          />
                          {t(
                            getCategoryLabelKey(ship.category),
                            CATEGORY_LABEL_FALLBACK[ship.category],
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                            stationary
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              stationary
                                ? "bg-amber-500"
                                : "bg-emerald-500 animate-pulse"
                            }`}
                          />
                          {stationary ? t("moored") : t("active")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-[12rem]">
                        {ship.destination ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono tabular-nums whitespace-nowrap">
                        {etaText ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-700 text-right tabular-nums whitespace-nowrap">
                        {formatSpeed(ship.speed, settings.speedUnit)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return resultMarkup;
};

export default FleetStatus;
