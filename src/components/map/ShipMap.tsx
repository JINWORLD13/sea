// 선박 지도: 해역 내 선박들의 위치와 항적을 시각화합니다.
// 船舶地図：海域内の船舶の位置と航跡を視覚化します。
// Ship Map: Visualizes ship positions and paths in the region.
import type { ReactElement, FC } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { DivIcon } from "leaflet";
import {
  useShipStore,
  matchShipQuery,
  selectDisplayShips,
} from "../../store/useShipStore";
import type { ShipData } from "../../store/useShipStore";
import { useTranslation } from "react-i18next";

const MAX_RENDERED_SHIPS = 250;
const iconCache = new Map<string, DivIcon>();

// 선종별 기본 색상 (선택되지 않았을 때)
// 船種別デフォルト色（未選択時）
// Default color by ship type (when not selected).
const getColorByShipType = (
  shipType: string,
): { color: string; glow: string } => {
  const t = (shipType || "").toLowerCase();
  if (t === "cargo")
    return { color: "#64748b", glow: "rgba(100, 116, 139, 0.35)" };
  if (t === "tanker")
    return { color: "#0ea5e9", glow: "rgba(14, 165, 233, 0.4)" };
  if (t === "tug") return { color: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)" };
  return { color: "#94a3b8", glow: "rgba(148, 163, 184, 0.35)" };
};

// 선박 아이콘 생성 (충돌 위험·지오펜싱에 따른 색상)
// 船舶アイコン作成（衝突リスク・ジオフェンシングによる色分け）
// Create ship icon (color by collision risk / geofencing)
const createShipIcon = (
  heading: number,
  isSelected: boolean,
  shipType: string,
  riskSeverity?: string,
  inRestrictedZone?: boolean,
): DivIcon => {
  const normalizedHeading = Math.round(heading / 5) * 5;
  const cacheKey = [
    normalizedHeading,
    isSelected ? 1 : 0,
    shipType,
    riskSeverity || "",
    inRestrictedZone ? 1 : 0,
  ].join("|");
  const cachedIcon = iconCache.get(cacheKey);
  if (cachedIcon) return cachedIcon;

  let color: string;
  let glow: string;
  if (isSelected === true) {
    color = "#c084fc";
    glow = "rgba(192, 132, 252, 0.6)";
    if (riskSeverity === "danger") {
      color = "#f87171";
      glow = "rgba(248, 113, 113, 0.8)";
    } else if (inRestrictedZone === true) {
      color = "#f97316";
      glow = "rgba(249, 115, 22, 0.6)";
    } else if (riskSeverity === "warning") {
      color = "#fbbf24";
      glow = "rgba(251, 191, 36, 0.6)";
    }
  } else {
    if (inRestrictedZone === true) {
      color = "#f97316";
      glow = "rgba(249, 115, 22, 0.6)";
    } else {
      const byType = getColorByShipType(shipType);
      color = byType.color;
      glow = byType.glow;
    }
  }

  let size: number = 40;
  if (isSelected === true) {
    size = 48;
  }

  // 모든 선박을 삼각형(선수 방향)으로 통일
  // 全船舶を三角形（船首方向）で統一
  // All ships use same triangle icon (bow direction).
  const innerIconSvg: string = `<path d="M12 7l4 10H8l4-10z" stroke="${color}" stroke-width="1.5" fill="${color}20" />`;

  const svgContentString: string = `
    <div style="transform: rotate(${normalizedHeading}deg); width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" style="filter: drop-shadow(0 0 6px ${glow});">
        <circle cx="12" cy="12" r="1.5" fill="${color}" />
        <g opacity="0.7">
          ${innerIconSvg}
        </g>
      </svg>
    </div>
  `;

  const iconConfig = {
    html: svgContentString,
    className: "ship-icon",
    iconSize: [size, size] as [number, number],
    iconAnchor: [size / 2, size / 2] as [number, number],
  };

  const finalIcon: DivIcon = L.divIcon(iconConfig);
  iconCache.set(cacheKey, finalIcon);
  return finalIcon;
};

interface RecenterProps {
  center: [number, number];
  regionId: string;
  zoom: number;
}

const RecenterMap: FC<RecenterProps> = (props: RecenterProps): null => {
  const mapInstance = useMap();
  useEffect(() => {
    mapInstance.setView(props.center, props.zoom);
  }, [props.center, props.regionId, props.zoom, mapInstance]);
  return null;
};

interface AutoFitShipsProps {
  ships: ShipData[];
  regionId: string;
  shouldSkip: boolean;
}

const AutoFitShips: FC<AutoFitShipsProps> = ({
  ships,
  regionId,
  shouldSkip,
}): null => {
  const mapInstance = useMap();
  const hasFittedRef = useRef<boolean>(false);

  useEffect(() => {
    hasFittedRef.current = false;
  }, [regionId]);

  useEffect(() => {
    if (shouldSkip) return;
    if (hasFittedRef.current) return;
    if (ships.length === 0) return;

    if (ships.length === 1) {
      const only = ships[0];
      mapInstance.setView([only.position.lat, only.position.lng], 7);
      hasFittedRef.current = true;
      return;
    }

    const bounds = L.latLngBounds(
      ships.map((s) => [s.position.lat, s.position.lng] as [number, number]),
    );
    mapInstance.fitBounds(bounds, { padding: [32, 32], maxZoom: 6 });
    hasFittedRef.current = true;
  }, [ships, shouldSkip, mapInstance]);

  return null;
};

interface ViewportTrackerProps {
  onBoundsChange: (bounds: L.LatLngBounds) => void;
}

const ViewportTracker: FC<ViewportTrackerProps> = ({
  onBoundsChange,
}): null => {
  const map = useMapEvents({
    moveend: () => {
      onBoundsChange(map.getBounds());
    },
    zoomend: () => {
      onBoundsChange(map.getBounds());
    },
  });

  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);

  return null;
};

const ShipMap: FC = (): ReactElement => {
  const { t } = useTranslation();
  const shipStore = useShipStore();
  const ships = useShipStore(selectDisplayShips);
  const selectedShipMmsi = shipStore.selectedShipMmsi;
  const currentRegion = shipStore.currentRegion;
  const mapCenterOverride = shipStore.mapCenterOverride;
  const selectShip = shipStore.selectShip;
  const searchQuery = shipStore.searchQuery;
  const marinaMode = shipStore.marinaMode;
  const [viewBounds, setViewBounds] = useState<L.LatLngBounds | null>(null);

  const shipsList = useMemo(() => Object.values(ships) as ShipData[], [ships]);
  const filteredShips: ShipData[] = useMemo(() => {
    return shipsList.filter((shipItem: ShipData) => {
      const isSearchMatch: boolean = matchShipQuery(shipItem, searchQuery);
      if (marinaMode === false) {
        return isSearchMatch;
      }
      const isBelowSpeedHeader: boolean = shipItem.speed < 7;
      const isAboveZero: boolean = shipItem.speed > 0;
      const result: boolean =
        isSearchMatch && isBelowSpeedHeader && isAboveZero;
      return result;
    });
  }, [shipsList, searchQuery, marinaMode]);
  const inViewShips: ShipData[] = useMemo(() => {
    if (viewBounds === null) return filteredShips;
    return filteredShips.filter((ship) =>
      viewBounds.contains([ship.position.lat, ship.position.lng]),
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

  /**
   * [KO]
   * <div(컨테이너)>
   *  <MapContainer(지도)>
   *    <TileLayer />
   *    <RecenterMap />
   *    <Marker(선박)>
   *      <Popup />
   *    </Marker>
   *    <Polyline(항적)>
   *  </MapContainer>
   *  <div(상태 오버레이)>
   *  <div(통계 정보 패널)>
   * </div>
   */
  /**
   * [JA]
   * <div(コンテナ)>
   *  <MapContainer(マップ)>
   *    <TileLayer />
   *    <RecenterMap />
   *    <Marker(船舶)>
   *      <Popup />
   *    </Marker>
   *    <Polyline(航跡)>
   *  </MapContainer>
   *  <div(ステータスオーバーレイ)>
   *  <div(統計情報パネル)>
   * </div>
   */
  /**
   * [EN]
   * <div(Container)>
   *  <MapContainer(Map)>
   *    <TileLayer />
   *    <RecenterMap />
   *    <Marker(Vessel)>
   *      <Popup />
   *    </Marker>
   *    <Polyline(Path)>
   *  </MapContainer>
   *  <div(Status Overlay)>
   *  <div(Statistics Panel)>
   * </div>
   */

  const mapCenter: [number, number] = mapCenterOverride ?? currentRegion.center;
  const mapZoom = mapCenterOverride
    ? 12
    : currentRegion.id === "singapore"
      ? 2
      : 12;

  const mapMarkup: ReactElement = (
    <div className="w-full h-full relative z-0 bg-[#0b0e14]">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%", background: "#0b0e14" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <RecenterMap
          center={mapCenter}
          regionId={mapCenterOverride ? "override" : currentRegion.id}
          zoom={mapZoom}
        />
        <ViewportTracker onBoundsChange={setViewBounds} />
        <AutoFitShips
          ships={renderShips}
          regionId={currentRegion.id}
          shouldSkip={Boolean(mapCenterOverride) || Boolean(selectedShipMmsi)}
        />

        {renderShips.map((ship: ShipData) => {
          const isThisSelected: boolean = selectedShipMmsi === ship.id;
          const markerPos: [number, number] = [
            ship.position.lat,
            ship.position.lng,
          ];

          const shipClickHandler = () => {
            selectShip(ship.id);
          };

          return (
            <div key={ship.id}>
              {isThisSelected === true && (
                <CircleMarker
                  center={markerPos}
                  radius={14}
                  pathOptions={{
                    color: "#c084fc",
                    weight: 3,
                    fillColor: "#c084fc",
                    fillOpacity: 0.08,
                    className: "selected-ship-ring",
                  }}
                />
              )}
              <Marker
                position={markerPos}
                icon={createShipIcon(
                  ship.heading,
                  isThisSelected,
                  ship.type,
                  isThisSelected ? ship.risk?.severity : undefined,
                  ship.inRestrictedZone,
                )}
                eventHandlers={{
                  click: shipClickHandler,
                }}
              >
                <Popup className="glass-popup">
                  <div className="text-white min-w-[180px] p-1">
                    <div className="border-b border-white/10 pb-2 mb-2 font-black text-xs uppercase tracking-widest flex justify-between items-center text-indigo-400">
                      <span>{ship.name}</span>
                      {isThisSelected === true && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 rounded border border-emerald-500/30">
                          {t("locked")}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mb-2 font-mono">
                      {t("mmsi")}: {ship.id}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-bold">
                      <div className="bg-white/5 p-2 rounded border border-white/5 text-center">
                        <span className="block text-[10px] text-slate-500 uppercase mb-1">
                          {t("currentSpeed")}
                        </span>
                        {ship.speed.toFixed(1)} KN
                      </div>
                      <div className="bg-white/5 p-2 rounded border border-white/5 text-center">
                        <span className="block text-[10px] text-slate-500 uppercase mb-1">
                          {t("course")}
                        </span>
                        {ship.heading}°
                      </div>
                    </div>
                    <button
                      onClick={shipClickHandler}
                      className={`w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                        isThisSelected === true
                          ? "bg-indigo-500 text-white shadow-lg"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {isThisSelected === true
                        ? t("trackingActive")
                        : t("initializeLink")}
                    </button>
                  </div>
                </Popup>
              </Marker>

              {isThisSelected === true && ship.path.length > 0 && (
                <Polyline
                  positions={ship.path.map((pathItem) => [
                    pathItem.lat,
                    pathItem.lng,
                  ])}
                  pathOptions={{
                    color: "#c084fc",
                    weight: 2,
                    dashArray: "4, 8",
                    opacity: 0.8,
                  }}
                />
              )}
            </div>
          );
        })}
      </MapContainer>

      {/*
        해역 오버레이
        海域オーバーレイ
        Map Overlays
      */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        {Object.keys(ships).length === 0 && (
          <div className="bg-black/80 backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-indigo-500/30 flex items-center gap-3 animate-pulse">
            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_8px_indigo]"></div>
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
              {t("syncingAisFeed")}
            </span>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 right-6 bg-black/70 backdrop-blur-xl p-5 rounded-3xl shadow-2xl z-[1000] border border-white/10 min-w-[180px]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-slate-500 font-bold text-xs uppercase tracking-tighter">
            {t("vesselsDetected")}
          </span>
          <span className="font-black text-indigo-400 text-sm">
            {renderShips.length}
          </span>
        </div>
        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 animate-scanning"
            style={{ width: "40%" }}
          ></div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-emerald-500 font-mono tracking-tighter">
            LIVE STREAMING
          </span>
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
        </div>
      </div>

      <style>{`
        .leaflet-container { background-color: #0b0e14 !important; }
        .selected-ship-ring { pointer-events: none !important; }
        .glass-popup .leaflet-popup-content-wrapper {
            background: rgba(15, 23, 42, 0.9) !important;
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            color: white;
        }
        .glass-popup .leaflet-popup-tip { background: rgba(15, 23, 42, 0.9) !important; }
        @keyframes scanning { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
        .animate-scanning { animation: scanning 3s infinite ease-in-out; }
      `}</style>
    </div>
  );

  return mapMarkup;
};

export default ShipMap;
