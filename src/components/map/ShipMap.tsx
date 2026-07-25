// 선박 지도: 해역 내 선박들의 위치와 항적을 시각화합니다.
// Ship Map: visualizes ship positions and paths in the region. Sub-components live in
// ./mapControls, ./ShipMarker, ./ShipsLayer; shared constants/helpers in ./mapShared.
import { memo, startTransition, useCallback, useEffect, useMemo, useState } from "react";
import type { FC, ReactElement } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import {
  useShipStore,
  matchShipQuery,
  updateViewportSubscription,
} from "../../store/useShipStore";
import type { ShipData } from "../../store/useShipStore";
import { useShipSnapshot } from "../../hooks/useShipSnapshot";
import { BASEMAPS, SEAMARK_OVERLAY } from "./basemaps";
import { MAX_RENDERED_SHIPS, REPORT_AGE_REFRESH_MS } from "./mapShared";
import {
  AutoFitShips,
  BasemapControl,
  RecenterMap,
  ViewportTracker,
} from "./mapControls";
import { ReplayGhostLayer, ShipsLayer } from "./ShipsLayer";

const ShipMap: FC = (): ReactElement => {
  const { t } = useTranslation();
  const selectedShipMmsi = useShipStore((state) => state.selectedShipMmsi);
  const currentRegion = useShipStore((state) => state.currentRegion);
  const mapCenterOverride = useShipStore((state) => state.mapCenterOverride);
  const selectShip = useShipStore((state) => state.selectShip);
  const searchQuery = useShipStore((state) => state.searchQuery);
  const marinaMode = useShipStore((state) => state.marinaMode);
  const streamStatus = useShipStore((state) => state.streamStatus);
  const settings = useShipStore((state) => state.settings);
  const fleetMmsis = useShipStore((state) => state.fleetMmsis);
  const activeFleetOnly = useShipStore((state) => state.activeFleetOnly);
  const [viewBounds, setViewBounds] = useState<L.LatLngBounds | null>(null);
  const [isMapInteracting, setIsMapInteracting] = useState<boolean>(false);
  const ships = useShipSnapshot({
    pause: isMapInteracting,
    delayMs: 700,
    resumeDelayMs: 80,
  });

  // 팝업의 "마지막 수신" 경과 표시를 위한 저빈도 시계 틱.
  // Low-frequency clock tick that refreshes the popup report age.
  const [clockTick, setClockTick] = useState<number>(0);
  useEffect(() => {
    const timer = window.setInterval(
      () => setClockTick((n) => n + 1),
      REPORT_AGE_REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  const handleBoundsChange = useCallback((bounds: L.LatLngBounds): void => {
    // 화면 영역 기준으로 AIS 구독을 갱신(디바운스는 스토어가 처리).
    // Refresh the AIS subscription to the visible area (store debounces it).
    updateViewportSubscription([
      bounds.getSouth(),
      bounds.getWest(),
      bounds.getNorth(),
      bounds.getEast(),
    ]);
    startTransition(() => {
      setViewBounds(bounds);
    });
  }, []);

  const handleInteractionChange = useCallback((isInteracting: boolean): void => {
    setIsMapInteracting(isInteracting);
  }, []);

  const shipsList = useMemo(() => Object.values(ships) as ShipData[], [ships]);

  // 스트림 상태 → 오버레이 문구/색. "reconnecting"도 그대로 노출한다.
  // Stream state -> overlay text/colors, including the "reconnecting" state.
  const statusText =
    streamStatus.state === "error"
      ? streamStatus.error || t("aisDisconnected")
      : streamStatus.state === "reconnecting"
        ? t("aisReconnecting", "Reconnecting to AIS stream...")
        : streamStatus.state === "connecting"
          ? t("connectingAis")
          : shipsList.length === 0
            ? t("aisWaiting")
            : t("streamingActive");
  const statusTone: "rose" | "amber" | "emerald" =
    streamStatus.state === "error"
      ? "rose"
      : streamStatus.state === "live" && shipsList.length > 0
        ? "emerald"
        : "amber";
  const statusColorClass =
    statusTone === "rose"
      ? "border-rose-500/30 text-rose-400"
      : statusTone === "amber"
        ? "border-amber-500/30 text-amber-400"
        : "border-emerald-500/30 text-emerald-400";
  const statusDotClass =
    statusTone === "rose"
      ? "bg-rose-500"
      : statusTone === "amber"
        ? "bg-amber-500"
        : "bg-emerald-500";

  // 함대 모드가 켜져 있으면 함대 선박만 남긴다(검색/마리나 필터와 결합).
  // Fleet mode narrows to fleet members (combined with search/marina filters).
  const fleetFilterActive = activeFleetOnly === true && fleetMmsis.length > 0;
  const fleetSet = useMemo(() => new Set(fleetMmsis), [fleetMmsis]);
  const filteredShips: ShipData[] = useMemo(() => {
    return shipsList.filter((shipItem: ShipData) => {
      if (fleetFilterActive === true && fleetSet.has(shipItem.id) === false) {
        return false;
      }
      if (matchShipQuery(shipItem, searchQuery) === false) {
        return false;
      }
      if (marinaMode === false) {
        return true;
      }
      // 마리나 모드: 7노트 미만으로 움직이는 소형 선박(항로표지/기지국 제외).
      // Marina mode: small craft moving under 7 kn (excludes aton/base).
      return (
        shipItem.kind === "vessel" &&
        shipItem.speed > 0 &&
        shipItem.speed < 7
      );
    });
  }, [shipsList, searchQuery, marinaMode, fleetFilterActive, fleetSet]);

  const inViewShips: ShipData[] = useMemo(() => {
    if (viewBounds === null) return filteredShips;
    // 경계를 살짝 넓혀 화면 가장자리에서 마커가 갑자기 사라지지 않게 한다.
    // Pad the bounds slightly so edge markers don't pop in/out.
    const padded = viewBounds.pad(0.05);
    return filteredShips.filter((ship) =>
      padded.contains([ship.position.lat, ship.position.lng]),
    );
  }, [filteredShips, viewBounds]);

  const renderShips: ShipData[] = useMemo(() => {
    if (inViewShips.length <= MAX_RENDERED_SHIPS) return inViewShips;

    const selected = selectedShipMmsi
      ? inViewShips.find((s) => s.id === selectedShipMmsi) || null
      : null;
    const anchor = selected
      ? selected.position
      : mapCenterOverride
        ? { lat: mapCenterOverride[0], lng: mapCenterOverride[1] }
        : { lat: currentRegion.center[0], lng: currentRegion.center[1] };

    const sorted = [...inViewShips].sort((a, b) => {
      const da =
        Math.abs(a.position.lat - anchor.lat) +
        Math.abs(a.position.lng - anchor.lng);
      const db =
        Math.abs(b.position.lat - anchor.lat) +
        Math.abs(b.position.lng - anchor.lng);
      return da - db;
    });

    const limited = sorted.slice(0, MAX_RENDERED_SHIPS);
    if (selected && limited.some((s) => s.id === selected.id) === false) {
      limited.pop();
      limited.unshift(selected);
    }
    return limited;
  }, [inViewShips, selectedShipMmsi, mapCenterOverride, currentRegion.center]);

  // 렌더 상한에 걸려 숨겨진 선박 수(정직한 "+N more" 칩에 사용).
  // Ships hidden by the render cap (drives the honest "+N more" chip).
  const hiddenCount = Math.max(0, inViewShips.length - renderShips.length);

  // "감지된 선박" 카운트에서 항로표지(aton)/기지국(base)은 제외한다.
  // Aids-to-navigation and base stations are excluded from vessel counts.
  const renderVesselCount = useMemo(
    () =>
      renderShips.reduce(
        (count, ship) => (ship.kind === "vessel" ? count + 1 : count),
        0,
      ),
    [renderShips],
  );
  const filteredVesselCount = useMemo(
    () =>
      filteredShips.reduce(
        (count, ship) => (ship.kind === "vessel" ? count + 1 : count),
        0,
      ),
    [filteredShips],
  );

  // 렌더 커버리지: 화면에 실제로 그려진 비율(가짜 스캐닝 바 대체).
  // Render coverage: the real rendered/filtered ratio (replaces the fake bar).
  const coveragePct = Math.min(
    100,
    Math.round((renderShips.length / Math.max(filteredShips.length, 1)) * 100),
  );

  /**
   * [KO]
   * <div(컨테이너)>
   *  <MapContainer(지도)>
   *    <TileLayer(베이스맵)> + <TileLayer(항로표지 오버레이)>
   *    <RecenterMap /> <ViewportTracker /> <AutoFitShips />
   *    <ShipsLayer(마커/클러스터/침로벡터/항적)>
   *    <ReplayGhostLayer(리플레이 고스트)>
   *  </MapContainer>
   *  <div(상태 오버레이)> <BasemapControl(레이어 컨트롤)>
   *  <div(+N 칩)> <div(통계 정보 패널)>
   * </div>
   */
  /**
   * [JA]
   *    <RecenterMap /> <ViewportTracker /> <AutoFitShips />
   *  </MapContainer>
   * </div>
   */
  /**
   * [EN]
   * <div(Container)>
   *  <MapContainer(Map)>
   *    <TileLayer(Basemap)> + <TileLayer(Seamark overlay)>
   *    <RecenterMap /> <ViewportTracker /> <AutoFitShips />
   *    <ShipsLayer(Markers/Clusters/Course vectors/Trail)>
   *    <ReplayGhostLayer(Replay ghost)>
   *  </MapContainer>
   *  <div(Status Overlay)> <BasemapControl(Layer control)>
   *  <div(+N chip)> <div(Statistics Panel)>
   * </div>
   */

  const mapCenter: [number, number] = mapCenterOverride ?? currentRegion.center;
  const mapZoom = mapCenterOverride
    ? 12
    : currentRegion.id === "singapore"
      ? 2
      : 12;

  const basemap = BASEMAPS[settings.basemap];

  const mapMarkup: ReactElement = (
    <div
      className="w-full h-full relative z-0"
      style={{ background: basemap.background }}
    >
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", background: basemap.background }}
      >
        <TileLayer
          key={basemap.id}
          attribution={basemap.attribution}
          url={basemap.url}
          maxZoom={basemap.maxZoom}
        />
        {settings.seamarks === true && (
          <TileLayer
            key="seamark-overlay"
            attribution={SEAMARK_OVERLAY.attribution}
            url={SEAMARK_OVERLAY.url}
            maxZoom={SEAMARK_OVERLAY.maxZoom}
            zIndex={10}
          />
        )}

        <RecenterMap
          center={mapCenter}
          regionId={mapCenterOverride ? "override" : currentRegion.id}
          zoom={mapZoom}
        />
        <ViewportTracker
          onBoundsChange={handleBoundsChange}
          onInteractionChange={handleInteractionChange}
        />
        <AutoFitShips
          ships={renderShips}
          regionId={currentRegion.id}
          shouldSkip={Boolean(mapCenterOverride) || Boolean(selectedShipMmsi)}
        />

        <ShipsLayer
          ships={renderShips}
          selectedShipMmsi={selectedShipMmsi}
          onSelect={selectShip}
          speedUnit={settings.speedUnit}
          showTrails={settings.showTrails}
          showCourseVectors={settings.showCourseVectors}
          clockTick={clockTick}
        />

        <ReplayGhostLayer ships={ships} />
      </MapContainer>

      {/*
        해역 오버레이
        Map Overlays
      */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        {(shipsList.length === 0 || streamStatus.state !== "live") && (
          <div
            className={`bg-black/80 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 ${statusColorClass}`}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full ${statusDotClass} ${
                streamStatus.state === "error" ? "" : "animate-pulse"
              }`}
            ></div>
            <span className="text-xs font-black uppercase tracking-widest">
              {statusText}
            </span>
          </div>
        )}
      </div>

      <BasemapControl />

      {hiddenCount > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-black/75 backdrop-blur-md border border-amber-500/30 text-amber-300 rounded-full px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider shadow-xl whitespace-nowrap">
          +{hiddenCount} {t("moreVesselsHidden", "more vessels — zoom in")}
        </div>
      )}

      <div className="absolute bottom-6 right-6 bg-black/70 backdrop-blur-xl p-5 rounded-3xl shadow-2xl z-[1000] border border-white/10 min-w-[180px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 font-bold text-xs uppercase tracking-tighter">
            {t("vesselsDetected")}
          </span>
          <span className="font-black text-indigo-400 text-sm">
            {renderVesselCount}/{filteredVesselCount}
          </span>
        </div>
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500"
            style={{ width: `${coveragePct}%` }}
          ></div>
        </div>
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-mono tracking-tighter ${
              streamStatus.state === "live"
                ? "text-emerald-500"
                : streamStatus.state === "error"
                  ? "text-rose-400"
                  : "text-amber-400"
            }`}
          >
            {streamStatus.state === "live"
              ? "LIVE AIS"
              : streamStatus.state.toUpperCase()}
          </span>
          <div
            className={`w-2 h-2 ${statusDotClass} rounded-full ${
              streamStatus.state === "live" ? "animate-pulse" : ""
            }`}
          />
        </div>
      </div>

      <style>{`
        .leaflet-container { background-color: ${basemap.background} !important; }
        .selected-ship-ring { pointer-events: none !important; }
        .glass-popup .leaflet-popup-content-wrapper {
            background: rgba(15, 23, 42, 0.9) !important;
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            color: white;
        }
        .glass-popup .leaflet-popup-tip { background: rgba(15, 23, 42, 0.9) !important; }
        .ship-tooltip {
            background: rgba(15, 23, 42, 0.92) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            color: #fff !important;
            border-radius: 8px !important;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px !important;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4) !important;
        }
        .ship-tooltip::before { border-top-color: rgba(15, 23, 42, 0.92) !important; }
        .replay-ghost { position: relative; width: 36px; height: 36px; display: block; }
        .replay-ghost-dot {
            position: absolute; left: 50%; top: 50%;
            width: 12px; height: 12px; margin: -6px 0 0 -6px;
            border-radius: 9999px;
            background: rgba(139, 92, 246, 0.75);
            border: 2px solid rgba(196, 181, 253, 0.9);
            box-shadow: 0 0 10px rgba(139, 92, 246, 0.8);
        }
        .replay-ghost-ring {
            position: absolute; inset: 0;
            border-radius: 9999px;
            border: 2px solid rgba(139, 92, 246, 0.6);
            animation: replay-ghost-pulse 1.6s ease-out infinite;
        }
        @keyframes replay-ghost-pulse {
            0% { transform: scale(0.4); opacity: 0.9; }
            100% { transform: scale(1.1); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
            .replay-ghost-ring { animation: none; opacity: 0.5; }
        }
      `}</style>
    </div>
  );

  return mapMarkup;
};

export default memo(ShipMap);
