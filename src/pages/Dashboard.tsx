// 메인 대시보드: 선박 지도와 상세 정보를 통합하여 보여줍니다.
// メインダッシュボード：船舶地図と詳細情報を統合して表示します。
// Main Dashboard: Integrates ship map and detailed information.
import { useState, useEffect, useMemo } from "react";
import {
  Globe,
  Compass,
  Anchor,
  History,
  Gauge,
  Fuel,
  Activity,
  Wind,
} from "lucide-react";
import {
  useShipStore,
  startAisStream,
  stopAisStream,
  matchShipQuery,
  selectDisplayShips,
} from "../store/useShipStore";
import Scene from "../components/3d/Scene";
import ShipMap from "../components/map/ShipMap";
import Alerts from "../components/dashboard/Alerts";
import ModeSwitcher from "../components/dashboard/ModeSwitcher";
import StatsBar from "../components/dashboard/StatsBar";
import { useTranslation } from "react-i18next";

const Dashboard = () => {
  // 플랫폼 모드 상태 관리
  // プラットフォームモードの状態管理
  // Manage platform mode state.
  const [platformMode, setPlatformMode] = useState<
    "fleet" | "safety" | "marina"
  >("fleet");

  const shipStore = useShipStore();
  const shipsMap = useShipStore(selectDisplayShips);
  const selectedMmsi = shipStore.selectedShipMmsi;
  const regionObj = shipStore.currentRegion;
  const updateRegion = shipStore.setRegion;
  const fleetMmsisList = shipStore.fleetMmsis;
  const searchQuery = shipStore.searchQuery;
  const isFleetOnly = shipStore.activeFleetOnly;
  const toggleFleetMode = shipStore.setFleetMode;
  const toggleMarinaMode = shipStore.setMarinaMode;

  const translation = useTranslation();
  const { t } = translation;
  const i18nObj = translation.i18n;

  // 버튼 클릭 시 모드 전환 처리
  // ボタンクリック時のモード切替処理
  // Handle mode switching on button click.
  const handleSwitchMode = (mode: "fleet" | "safety" | "marina") => {
    setPlatformMode(mode);
    if (mode === "fleet") {
      toggleFleetMode(true);
      toggleMarinaMode(false);
    } else if (mode === "marina") {
      toggleFleetMode(false);
      toggleMarinaMode(true);
    } else {
      toggleFleetMode(false);
      toggleMarinaMode(false);
    }
  };

  const currentLang = i18nObj.language as "en" | "ko";
  const handleToggleLang = () => {
    if (currentLang === "ko") {
      i18nObj.changeLanguage("en");
    } else {
      i18nObj.changeLanguage("ko");
    }
  };

  const currentShip = selectedMmsi ? shipsMap[selectedMmsi] : null;

  // 예상 도착 시간(ETA) 계산
  // 到착予定時刻（ETA）の計算
  // Calculate Estimated Time of Arrival (ETA).
  const etaValue = useMemo(() => {
    if (currentShip === null || currentShip === undefined) {
      return "N/A";
    }
    if (currentShip.speed < 0.5) {
      return "N/A";
    }

    const distanceKm = 5.2; // 임의의 가상 거리 (Arbitrary distance)
    const timeHours = distanceKm / currentShip.speed;
    const timeMins = Math.round(timeHours * 60);
    const resultEta = timeMins + "m";
    return resultEta;
  }, [currentShip]);

  const shipCountTotal = Object.keys(shipsMap).length;
  const allShipsEntries = Object.values(shipsMap);
  const displayShipForPanel = currentShip ?? allShipsEntries[0] ?? null;
  const filteredFleetShips = allShipsEntries.filter((s) => {
    const isIncluded = fleetMmsisList.includes(s.id);
    return isIncluded;
  });
  const shipCountFleet = filteredFleetShips.length;

  // 검색어에 맞는 함대 목록만 표시
  // 検索語に合う艦隊リストのみ表示
  // Fleet list filtered by search.
  const fleetMmsisToShow = useMemo(() => {
    if (!searchQuery.trim()) return fleetMmsisList;
    return fleetMmsisList.filter((mmsi) => {
      const ship = shipsMap[mmsi];
      return ship ? matchShipQuery(ship, searchQuery) : false;
    });
  }, [fleetMmsisList, shipsMap, searchQuery]);

  // 검색 결과가 1척일 때 해당 선박 자동 선택
  // 検索結果が1隻のときその船舶を自動選択
  // Auto-select when single search result.
  const singleSearchMatchId = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const matches = allShipsEntries.filter((s) =>
      matchShipQuery(s, searchQuery),
    );
    return matches.length === 1 ? matches[0].id : null;
  }, [allShipsEntries, searchQuery]);
  useEffect(() => {
    if (singleSearchMatchId) {
      shipStore.selectShip(singleSearchMatchId);
    }
  }, [singleSearchMatchId]);

  // 초기 로드 및 실시간 데이터 스트리밍 시작 (해역 변경 시에만 재연결, 의존성 최소화로 HMR/리렌더 시 불필요한 끊김 방지)
  // 初期ロードおよびリアルタイムデータストリーミングの開始（海域変更時のみ再接続）
  useEffect(() => {
    const bounds = regionObj.bounds;
    startAisStream(bounds);

    const fullUrlSearch = window.location.search;
    const urlParams = new URLSearchParams(fullUrlSearch);
    const mmsiFromUrl = urlParams.get("mmsi");
    if (mmsiFromUrl !== null) {
      const shipManager = useShipStore.getState();
      shipManager.selectShip(mmsiFromUrl);
    }

    const timerInterval = setInterval(() => {
      const state = useShipStore.getState();
      state.checkRisks();
      state.tick();
    }, 2000);

    return () => {
      stopAisStream();
      clearInterval(timerInterval);
    };
    // regionObj.id만 의존: 해역이 바뀔 때만 스트림 재시작. checkRiskFunc/tickFunc 제거로 리렌더 시 불필요한 연결 해제 방지.
  }, [regionObj.id]);

  /**
   * [KO]
   * <div(컨테이너)>
   *  <div(운영 모드 선택기)>
   *  <div(주 정보 헤더)>
   *  <div(상황 통계 바)>
   *  <div(데이터 그리드)>
   *    <div(함대 목록)>
   *    <div(지도 영역)>
   *    <div(라이브 인텔리전스 및 알림)>
   *  </div>
   * </div>
   */
  /**
   * [JA]
   * <div(コンテナ)>
   *  <div(運用モードセレクター)>
   *  <div(主要情報ヘッダー)>
   *  <div(状況統計バー)>
   *  <div(データグリッド)>
   *    <div(艦隊リスト)>
   *    <div(マップエリア)>
   *    <div(ライブインテリジェンスと通知)>
   *  </div>
   * </div>
   */
  /**
   * [EN]
   * <div(Container)>
   *  <div(Operation Mode Switcher)>
   *  <div(Main Info Header)>
   *  <div(Status Statistics Bar)>
   *  <div(Data Grid)>
   *    <div(Fleet List)>
   *    <div(Map Area)>
   *    <div(Live Intelligence & Alerts)>
   *  </div>
   * </div>
   */
  return (
    <div className="space-y-6 pb-12">
      <title>Dashboard - {t("appName")}</title>
      <ModeSwitcher
        platformMode={platformMode}
        onSwitchMode={handleSwitchMode}
        t={t}
      />

      {/*
        2. 주 정보 헤더
        2. 主要情報ヘッダー
        2. Main Info Header
      */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl glass-panel relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />

        <div className="relative z-10">
          <h2 className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
            {currentShip ? (
              <>
                <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                  <Anchor size={24} className="text-indigo-400" />
                </div>
                <div>
                  <div className="text-2xl">{currentShip.name}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">
                      MMSI: {currentShip.id}
                    </span>
                    <span className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span className="text-xs text-emerald-400 font-black uppercase">
                      ETA: {etaValue}
                    </span>
                    <span className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span className="text-xs text-indigo-400 font-black uppercase">
                      {currentShip.type}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <Compass size={28} className="text-indigo-400" />
                <span className="text-2xl">{t("opsConsole")}</span>
              </>
            )}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
            {[
              { id: "busan", label: t("regionBusan") },
              { id: "incheon", label: t("regionIncheon") },
              { id: "singapore", label: t("regionGlobal") },
            ].map((reg) => {
              let regBtnStyles =
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ";
              if (regionObj.id === reg.id) {
                regBtnStyles =
                  regBtnStyles +
                  "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30";
              } else {
                regBtnStyles =
                  regBtnStyles + "text-slate-500 hover:text-slate-300";
              }
              return (
                <button
                  key={reg.id}
                  onClick={() => {
                    updateRegion(reg.id as "busan" | "incheon" | "singapore");
                  }}
                  className={regBtnStyles}
                >
                  {reg.label}
                </button>
              );
            })}
          </div>
          <div className="w-px h-6 bg-white/5 mx-1" />
          <button
            onClick={handleToggleLang}
            className="flex items-center gap-2 px-4 py-2 rounded-xl glass-button text-white text-xs font-black uppercase"
          >
            <Globe size={16} className="text-indigo-400" />
            {currentLang?.toUpperCase()}
          </button>
        </div>
      </div>

      <StatsBar
        isFleetOnly={isFleetOnly}
        shipCountFleet={shipCountFleet}
        shipCountTotal={shipCountTotal}
        t={t}
      />

      {/*
        4. 데이터 표시 그리드
        4. データ表示グリッド
        4. Data Display Grid
      */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card rounded-2xl p-6 h-[500px] flex flex-col">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
              <span>{t("fleetDeployment")}</span>
              <Anchor size={18} className="text-indigo-400" />
            </h3>
            {searchQuery.trim() && (
              <p className="text-xs text-indigo-400/90 mb-2 font-medium">
                {t("searchLabel")}: &quot;{searchQuery}&quot; —{" "}
                {fleetMmsisToShow.length}{" "}
                {fleetMmsisToShow.length !== 1 ? t("vessels") : t("vessel")}
              </p>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {fleetMmsisList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
                    <Anchor size={24} className="text-slate-600" />
                  </div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">
                    {t("noVesselsRegistered")}
                  </p>
                </div>
              ) : (
                fleetMmsisToShow.map((mmsiID) => {
                  const sObj = shipsMap[mmsiID];
                  let itemStyles =
                    "p-4 rounded-xl border transition-all cursor-pointer ";
                  if (selectedMmsi === mmsiID) {
                    itemStyles =
                      itemStyles +
                      "bg-indigo-500/20 border-indigo-500/50 shadow-lg";
                  } else {
                    itemStyles =
                      itemStyles +
                      "bg-white/5 border-white/5 hover:border-white/10";
                  }

                  let dotStyles = "w-2 h-2 rounded-full ";
                  if (sObj && sObj.speed > 0.5) {
                    dotStyles = dotStyles + "bg-emerald-500";
                  } else {
                    dotStyles = dotStyles + "bg-amber-500";
                  }

                  return (
                    <div
                      key={mmsiID}
                      onClick={() => {
                        const storeInstance = useShipStore.getState();
                        storeInstance.selectShip(mmsiID);
                      }}
                      className={itemStyles}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-white truncate pr-2">
                          {sObj?.name || t("mmsi") + " " + mmsiID}
                        </p>
                        <button
                          onClick={(mouseEvent) => {
                            mouseEvent.stopPropagation();
                            const storeInstance = useShipStore.getState();
                            storeInstance.removeFromFleet(mmsiID);
                          }}
                          className="text-white/20 hover:text-red-400 px-1"
                        >
                          ×
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500 font-mono">
                          {(sObj?.speed || 0).toFixed(1)} KN
                        </p>
                        <div className={dotStyles} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {currentShip &&
              fleetMmsisList.includes(selectedMmsi || "") === false && (
                <button
                  onClick={() => {
                    const storeInstance = useShipStore.getState();
                    if (selectedMmsi) {
                      storeInstance.addToFleet(selectedMmsi);
                    }
                  }}
                  className="w-full mt-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg"
                >
                  {t("registerToFleet")}
                </button>
              )}

            {currentShip && currentShip.path.length > 0 && (
              <div className="mt-6 pt-5 border-t border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} />
                    Historical Replay
                  </h4>
                  <span className="text-xs text-indigo-400 font-mono">
                    {currentShip.path.length} {t("pts")}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={currentShip.path.length - 1}
                  className="w-full accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  onChange={(changeEvent) => {
                    const sliderValue = changeEvent.target.value;
                    const pathIndex = parseInt(sliderValue);
                    const historicalPoint = currentShip.path[pathIndex];
                    if (historicalPoint) {
                      const storeInstance = useShipStore.getState();
                      const payload = {
                        position: {
                          lat: historicalPoint.lat,
                          lng: historicalPoint.lng,
                        },
                      };
                      const config = {
                        skipPathRecord: true,
                      };
                      storeInstance.updateShip(currentShip.id, payload, config);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="glass-card rounded-2xl h-[500px] relative overflow-hidden ring-1 ring-white/10">
            <ShipMap />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border-l-4 border-indigo-500">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase">
                  {t("velocity")}
                </p>
                <Gauge size={16} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-white">
                {currentShip?.speed.toFixed(1) || "0.0"}{" "}
                <span className="text-xs text-slate-500 font-normal ml-1">
                  KN
                </span>
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border-l-4 border-emerald-500 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase">
                  {t("energy")}
                </p>
                <Fuel size={16} className="text-emerald-400 shrink-0" />
              </div>
              <p
                className="text-2xl font-black text-white truncate"
                title={
                  typeof currentShip?.fuel === "number"
                    ? String(currentShip.fuel)
                    : "100"
                }
              >
                {typeof currentShip?.fuel === "number"
                  ? currentShip.fuel.toFixed(1)
                  : "100"}
                <span className="text-xs text-slate-500 font-normal ml-1">
                  %
                </span>
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border-l-4 border-amber-500">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase">
                  {t("dynamics")}
                </p>
                <Activity size={16} className="text-amber-500" />
              </div>
              <p className="text-sm font-bold text-white leading-relaxed">
                R: {currentShip?.motion.roll.toFixed(1) || "0.0"}°<br />
                P: {currentShip?.motion.pitch.toFixed(1) || "0.0"}°
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border-l-4 border-violet-500">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase">
                  {t("atmosphere")}
                </p>
                <Wind size={16} className="text-violet-400" />
              </div>
              <p className="text-2xl font-black text-white">
                {currentShip?.wind.speed || "0"}{" "}
                <span className="text-xs text-slate-500 font-normal ml-1">
                  KN
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card rounded-2xl h-[500px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/5 flex bg-black/40 items-center justify-between shrink-0">
              <span className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                <Activity size={16} />
                {t("liveIntelligence")}
              </span>
            </div>

            <div className="flex-1 min-h-0 flex flex-col relative bg-slate-900/40 w-full">
              {displayShipForPanel ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="h-[320px] w-full shrink-0 relative bg-black">
                    <Scene />
                  </div>
                  <div className="p-5 bg-black/40 border-t border-white/5 shrink-0 min-h-0 overflow-y-auto">
                    <h4 className="text-xs font-black text-indigo-400 mb-3 uppercase tracking-wider">
                      {t("vesselIdentification")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs break-words">
                      <div className="text-slate-500 uppercase min-w-0">
                        {t("imoNo")}:{" "}
                        <span className="text-white font-mono ml-1 break-all">
                          {displayShipForPanel.imo || "-"}
                        </span>
                      </div>
                      <div className="text-slate-500 uppercase min-w-0">
                        {t("status")}:{" "}
                        <span className="text-emerald-400 font-mono ml-1">
                          {t("statusLive")}
                        </span>
                      </div>
                      <div className="text-slate-500 col-span-2 uppercase min-w-0">
                        {t("dest")}:{" "}
                        <span className="text-white font-mono ml-1 break-all">
                          {displayShipForPanel.destination || t("unspecified")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-5 border border-indigo-500/20">
                    <Activity
                      size={40}
                      className="text-indigo-400 animate-pulse"
                    />
                  </div>
                  <h3 className="text-white font-bold mb-2 uppercase text-sm tracking-widest">
                    {t("awaitingTelemetry")}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed uppercase tracking-tight">
                    {t("establishConnectionBySelecting")}
                  </p>
                </div>
              )}
            </div>
          </div>
          <Alerts />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
