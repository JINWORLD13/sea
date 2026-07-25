// 메인 대시보드: 선박 지도와 상세 정보를 통합하여 보여줍니다.
// Main Dashboard: Integrates ship map and detailed information.
import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import {
  Globe,
  Compass,
  Anchor,
  History,
  Gauge,
  Navigation,
  Ruler,
  Ship,
  Activity,
} from "lucide-react";
import {
  useShipStore,
  matchShipQuery,
} from "../store/useShipStore";
import {
  formatEta,
  getCategoryLabelKey,
  getNavStatusLabelKey,
} from "../utils/aisTypes";
import ShipMap from "../components/map/ShipMap";
import Alerts from "../components/dashboard/Alerts";
import ModeSwitcher from "../components/dashboard/ModeSwitcher";
import StatsBar from "../components/dashboard/StatsBar";
import { useTranslation } from "react-i18next";
import { useShipSnapshot } from "../hooks/useShipSnapshot";

// 3D 씬(three.js ~1MB)은 지연 로드하여 초기 번들/접속 속도를 개선한다.
// Lazy-load the 3D scene (three.js, ~1MB) to keep the initial bundle small
// and the first paint fast.
const Scene = lazy(() => import("../components/3d/Scene"));

// 언어 토글 순환 순서 (en → ko → ja).
// Language toggle cycle order (en → ko → ja).
const LANGUAGE_CYCLE = ["en", "ko", "ja"] as const;

const Dashboard = () => {
  // 플랫폼 모드 상태 관리
  // Manage platform mode state.
  const [platformMode, setPlatformMode] = useState<
    "fleet" | "safety" | "marina"
  >("fleet");
  const shipsMap = useShipSnapshot({ delayMs: 800 });
  const selectedMmsi = useShipStore((state) => state.selectedShipMmsi);
  const regionObj = useShipStore((state) => state.currentRegion);
  const updateRegion = useShipStore((state) => state.setRegion);
  const fleetMmsisList = useShipStore((state) => state.fleetMmsis);
  const searchQuery = useShipStore((state) => state.searchQuery);
  const isFleetOnly = useShipStore((state) => state.activeFleetOnly);
  const toggleFleetMode = useShipStore((state) => state.setFleetMode);
  const toggleMarinaMode = useShipStore((state) => state.setMarinaMode);
  const speedUnit = useShipStore((state) => state.settings.speedUnit);

  const translation = useTranslation();
  const { t } = translation;
  const i18nObj = translation.i18n;

  // 버튼 클릭 시 모드 전환 처리: fleet은 실제 함대 필터, marina는 소형선(7kn 미만)
  // 필터, safety는 두 필터를 해제하고 전역 알림 피드 패널을 강조한다.
  // Handle mode switching: fleet applies the real fleet filter, marina applies the
  // small-craft (<7 kn) filter, safety clears both and highlights the global
  // alert-feed panel.
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

  // 현재 언어(지역코드 포함 가능)를 기본 언어로 축약한 뒤 en → ko → ja 순환.
  // Collapse the current language (may carry a region code) to its base form,
  // then cycle en → ko → ja.
  const baseLang = (i18nObj.language || "en").split("-")[0];
  const handleToggleLang = () => {
    const currentIndex = LANGUAGE_CYCLE.indexOf(
      baseLang as (typeof LANGUAGE_CYCLE)[number],
    );
    const nextLang = LANGUAGE_CYCLE[(currentIndex + 1) % LANGUAGE_CYCLE.length];
    i18nObj.changeLanguage(nextLang);
  };

  const currentShip = selectedMmsi ? shipsMap[selectedMmsi] : null;

  // 실제 AIS 항해 데이터(목적지 + ETA). 방송되지 않았으면 "—"로 정직하게 표기.
  // Real AIS voyage data (destination + ETA); honest "—" when not broadcast.
  const destinationText = currentShip?.destination?.trim() || "—";
  const etaText = (currentShip ? formatEta(currentShip.eta) : null) ?? "—";

  // 속도 단위 설정(kn/km/h)을 반영한 표기.
  // Speed formatting honoring the speed-unit setting (kn / km/h).
  const speedUnitLabel = speedUnit === "kmh" ? "KM/H" : "KN";
  const formatSpeedValue = (speedKn: number): string =>
    (speedUnit === "kmh" ? speedKn * 1.852 : speedKn).toFixed(1);

  const allShipsEntries = Object.values(shipsMap);
  // 통계에는 실제 선박(kind === "vessel")만 집계한다 (AtoN/기지국 제외).
  // Only true vessels count toward the stats (AtoN / base stations excluded).
  const shipCountTotal = allShipsEntries.filter(
    (s) => s.kind === "vessel",
  ).length;
  const filteredFleetShips = allShipsEntries.filter((s) => {
    const isIncluded = fleetMmsisList.includes(s.id);
    return isIncluded;
  });
  const shipCountFleet = filteredFleetShips.length;

  // 검색어에 맞는 함대 목록만 표시
  // Fleet list filtered by search.
  const fleetMmsisToShow = useMemo(() => {
    if (!searchQuery.trim()) return fleetMmsisList;
    return fleetMmsisList.filter((mmsi) => {
      const ship = shipsMap[mmsi];
      return ship ? matchShipQuery(ship, searchQuery) : false;
    });
  }, [fleetMmsisList, shipsMap, searchQuery]);

  // 검색 결과가 1척일 때 해당 선박 자동 선택
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
      useShipStore.getState().selectShip(singleSearchMatchId);
    }
  }, [singleSearchMatchId]);

  // URL 공유 링크로 들어온 경우 해당 MMSI를 선택합니다.
  useEffect(() => {
    const fullUrlSearch = window.location.search;
    const urlParams = new URLSearchParams(fullUrlSearch);
    const mmsiFromUrl = urlParams.get("mmsi");
    if (mmsiFromUrl !== null) {
      const shipManager = useShipStore.getState();
      shipManager.selectShip(mmsiFromUrl);
    }
  }, []);

  // 궤적 리플레이: 슬라이더가 선택 선박의 타임스탬프 경로를 스크럽하며
  // 지도에는 고스트 마커만 그린다. 라이브 선박 데이터는 절대 변경하지 않는다.
  // 선택 변경/페이지 이탈 시 고스트를 반드시 정리한다.
  // Track replay: the slider scrubs the selected ship's timestamped path and
  // drives a ghost marker only — the live vessel is NEVER mutated. The ghost is
  // always cleared when the selection changes or the page unmounts.
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  // 선택 선박이 바뀌면 리플레이 인덱스를 초기화한다. React 권장 패턴에 따라
  // effect 안의 setState 대신 렌더 중 이전값 비교로 상태를 조정한다.
  // Reset the replay index when the selected ship changes, using React's
  // "adjust state during render" pattern instead of setState inside an effect.
  const [replayTrackedMmsi, setReplayTrackedMmsi] = useState<string | null>(
    selectedMmsi,
  );
  if (replayTrackedMmsi !== selectedMmsi) {
    setReplayTrackedMmsi(selectedMmsi);
    setReplayIndex(null);
  }
  // 고스트는 외부 스토어(Zustand) 상태이므로 선택 변경/언마운트 시 정리한다.
  // The ghost lives in the external store, so clear it on selection change/unmount.
  useEffect(() => {
    return () => {
      useShipStore.getState().setReplayGhost(null);
    };
  }, [selectedMmsi]);

  const replayPath = currentShip?.path ?? [];
  const clampedReplayIndex =
    replayIndex === null
      ? null
      : Math.min(replayIndex, Math.max(replayPath.length - 1, 0));
  const scrubbedPoint =
    clampedReplayIndex === null ? null : (replayPath[clampedReplayIndex] ?? null);

  const handleScrub = (rawIndex: number) => {
    if (!currentShip || currentShip.path.length === 0) return;
    const index = Math.min(
      Math.max(rawIndex, 0),
      currentShip.path.length - 1,
    );
    const point = currentShip.path[index];
    if (!point) return;
    setReplayIndex(index);
    useShipStore.getState().setReplayGhost({
      mmsi: currentShip.id,
      lat: point.lat,
      lng: point.lng,
      ts: point.ts,
    });
  };

  const handleExitReplay = () => {
    setReplayIndex(null);
    useShipStore.getState().setReplayGhost(null);
  };

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
      <ModeSwitcher platformMode={platformMode} onSwitchMode={handleSwitchMode} />

      {/*
        2. 주 정보 헤더
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
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400 font-mono uppercase tracking-wider">
                      MMSI: {currentShip.id}
                    </span>
                    <span className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span className="text-xs text-indigo-400 font-black uppercase">
                      {t(getCategoryLabelKey(currentShip.category))}
                    </span>
                    <span className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span className="text-xs text-slate-400 font-mono uppercase">
                      {t("dest")}:{" "}
                      <span className="text-white">{destinationText}</span>
                    </span>
                    <span className="w-1 h-1 bg-slate-700 rounded-full" />
                    <span className="text-xs text-emerald-400 font-black uppercase">
                      ETA: {etaText}
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
            {baseLang.toUpperCase()}
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
                          {formatSpeedValue(sObj?.speed ?? 0)} {speedUnitLabel}
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

            {currentShip && currentShip.path.length > 1 && (
              <div className="mt-6 pt-5 border-t border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} />
                    {t("historicalReplay")}
                  </h4>
                  <span className="text-xs text-indigo-400 font-mono">
                    {currentShip.path.length} {t("pts")}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(currentShip.path.length - 1, 0)}
                  value={
                    clampedReplayIndex ??
                    Math.max(currentShip.path.length - 1, 0)
                  }
                  className="w-full accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  onChange={(changeEvent) => {
                    handleScrub(parseInt(changeEvent.target.value, 10));
                  }}
                />
                <div className="flex items-center justify-between mt-2">
                  {/*
                    스크럽 중이면 해당 지점의 수신 시각을, 아니면 LIVE를 표시.
                    Show the scrubbed point's report time, or LIVE otherwise.
                  */}
                  <span
                    className={
                      scrubbedPoint
                        ? "text-[11px] font-mono text-violet-300"
                        : "text-[11px] font-mono text-emerald-400"
                    }
                  >
                    {scrubbedPoint
                      ? new Date(scrubbedPoint.ts).toLocaleTimeString()
                      : t("live")}
                  </span>
                  {scrubbedPoint && (
                    <button
                      onClick={handleExitReplay}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white px-2 py-1 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                    >
                      {t("exitReplay", "Exit replay")}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="glass-card rounded-2xl h-[500px] relative overflow-hidden ring-1 ring-white/10">
            <ShipMap />
          </div>

          {/*
            선택 선박의 실제 AIS 텔레메트리 카드 (속도/침로/항해 상태/제원).
            방송되지 않은 값은 "—"로 정직하게 표기한다.
            Real AIS telemetry cards for the selected vessel (speed / course /
            nav status / dimensions). Unbroadcast values honestly show "—".
          */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border-l-4 border-indigo-500">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase">
                  {t("velocity")}
                </p>
                <Gauge size={16} className="text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-white">
                {currentShip ? formatSpeedValue(currentShip.speed) : "—"}{" "}
                <span className="text-xs text-slate-500 font-normal ml-1">
                  {speedUnitLabel}
                </span>
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border-l-4 border-emerald-500">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase">
                  {t("course")}
                </p>
                <Navigation size={16} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-white">
                {currentShip?.cog != null
                  ? Math.round(currentShip.cog) + "°"
                  : "—"}
              </p>
              <p className="text-[11px] text-slate-500 font-mono uppercase mt-1">
                {t("heading")}:{" "}
                {currentShip?.heading != null
                  ? currentShip.heading + "°"
                  : "—"}
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border-l-4 border-amber-500 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase">
                  {t("navStatusLabel", "Nav Status")}
                </p>
                <Ship size={16} className="text-amber-500 shrink-0" />
              </div>
              <p className="text-sm font-bold text-white leading-relaxed break-words">
                {currentShip
                  ? t(getNavStatusLabelKey(currentShip.navStatus))
                  : "—"}
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border-l-4 border-violet-500 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-400 uppercase">
                  {t("dimensionsLabel", "Dimensions")}
                </p>
                <Ruler size={16} className="text-violet-400 shrink-0" />
              </div>
              <p className="text-lg font-black text-white truncate">
                {currentShip?.length != null && currentShip?.width != null
                  ? `${currentShip.length}×${currentShip.width} m`
                  : "—"}
              </p>
              <p className="text-[11px] text-slate-500 font-mono uppercase mt-1">
                {t("draughtLabel", "Draught")}:{" "}
                {currentShip?.draught != null
                  ? currentShip.draught.toFixed(1) + " m"
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          <div className="glass-card rounded-2xl h-[500px] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-black/40 shrink-0">
              <span className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                <Activity size={16} />
                {t("liveIntelligence")}
              </span>
              {/*
                3D 씬은 시각화일 뿐임을 정직하게 밝힌다 (AIS에는 자세 데이터가 없음).
                Honest caption: the 3D scene is illustrative only (AIS carries
                no attitude data).
              */}
              <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                {t(
                  "digitalTwinDemoNote",
                  "Attitude data not present in AIS — animation is illustrative",
                )}
              </p>
            </div>

            <div className="flex-1 min-h-0 flex flex-col relative bg-slate-900/40 w-full">
              {currentShip ? (
                <div className="flex-1 min-h-0 flex flex-col">
                  <div className="h-[300px] w-full shrink-0 relative bg-black">
                    <Suspense
                      fallback={
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
                          {t("loading3d", "Loading 3D...")}
                        </div>
                      }
                    >
                      <Scene />
                    </Suspense>
                  </div>
                  <div className="p-5 bg-black/40 border-t border-white/5 shrink-0 min-h-0 overflow-y-auto">
                    <h4 className="text-xs font-black text-indigo-400 mb-3 uppercase tracking-wider">
                      {t("vesselIdentification")}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs break-words">
                      <div className="text-slate-500 uppercase min-w-0">
                        {t("imoNo")}:{" "}
                        <span className="text-white font-mono ml-1 break-all">
                          {currentShip.imo || "—"}
                        </span>
                      </div>
                      <div className="text-slate-500 uppercase min-w-0">
                        {t("callSign")}:{" "}
                        <span className="text-white font-mono ml-1 break-all">
                          {currentShip.callsign || "—"}
                        </span>
                      </div>
                      <div className="text-slate-500 col-span-2 uppercase min-w-0">
                        {t("dest")}:{" "}
                        <span className="text-white font-mono ml-1 break-all">
                          {currentShip.destination || t("unspecified")}
                        </span>
                      </div>
                      <div className="text-slate-500 col-span-2 uppercase min-w-0">
                        ETA:{" "}
                        <span className="text-white font-mono ml-1">
                          {formatEta(currentShip.eta) ?? "—"}
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
          <Alerts highlighted={platformMode === "safety"} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
