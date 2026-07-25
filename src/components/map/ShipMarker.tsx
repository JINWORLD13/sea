// 개별 선박 마커: 아이콘/회전, 데드레커닝 보간 애니메이션, 팝업/툴팁, 침로 벡터·항적.
// Single ship marker: icon/rotation, dead-reckoning tween, popup/tooltip, course vector & trail.
import { Fragment, memo, useEffect, useRef, useState } from "react";
import type { FC, ReactElement } from "react";
import { Marker, Popup, Tooltip, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import type { AppSettings, ShipData } from "../../store/useShipStore";
import {
  formatEta,
  getCategoryColor,
  getCategoryLabelKey,
  getNavStatusLabelKey,
} from "../../utils/aisTypes";
import { getShipIcon, quantizeHeading, resolveShipVisual } from "./shipIcons";
import {
  cancelTween,
  moveLayersSmoothly,
  prefersReducedMotion,
  snapLayers,
} from "./markerAnimation";
import type { MovableLayer } from "./markerAnimation";
import {
  COURSE_VECTOR_MIN_SOG_KN,
  DR_LERP_DURATION_MS,
  DR_SNAP_JUMP_METERS,
  courseVectorEnd,
  formatReportAge,
} from "./mapShared";

// 개별 선박 마커. memo로 감싸 위치/방향 등 실제 시각 정보가 바뀐 선박만
// 리렌더한다. 위치 이동은 공유 rAF 티커가 setLatLng로 보간하므로 React
// 리렌더는 아이콘/팝업 내용 갱신에만 쓰인다.
// Single ship marker, memoized so only ships whose visible state actually
// changed re-render. Movement is interpolated by the shared rAF ticker via
// setLatLng; React re-renders only refresh icon/popup content.
interface ShipMarkerProps {
  ship: ShipData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  speedUnit: AppSettings["speedUnit"];
  showTrail: boolean;
  showVector: boolean;
  animate: boolean;
  clockTick: number;
}

const ShipMarkerBase: FC<ShipMarkerProps> = ({
  ship,
  isSelected,
  onSelect,
  speedUnit,
  showTrail,
  showVector,
  animate,
  clockTick,
}): ReactElement => {
  // 언어 변경 시 팝업 텍스트가 갱신되도록 마커 내부에서 t를 구독한다.
  // Subscribe to t inside the marker so popups update on language change.
  const { t } = useTranslation();
  // clockTick은 memo 비교를 깨뜨려 "마지막 수신" 경과 표시를 재계산시킨다.
  // clockTick busts the memo comparison so the report age recomputes.
  void clockTick;

  const markerRef = useRef<L.Marker | null>(null);
  const ringRef = useRef<L.CircleMarker | null>(null);
  // 최초 마운트 위치. 이후 이동은 애니메이션 모듈이 setLatLng로 처리하므로
  // position prop을 고정해 React 경유의 즉시 스냅을 막는다.
  // Position at mount time; afterwards the animation module owns movement via
  // setLatLng, so the prop stays stable to keep React from snapping it.
  // Capture the mount-time position once via a lazy useState initializer; the
  // animation module then owns movement through setLatLng, so the prop stays
  // stable and React never snaps the marker (which would defeat dead reckoning).
  // Using state instead of a ref keeps the render pure (no ref access in render).
  const [mountPosition] = useState<[number, number]>(() => [
    ship.position.lat,
    ship.position.lng,
  ]);

  const targetLat = ship.position.lat;
  const targetLng = ship.position.lng;

  useEffect(() => {
    const marker = markerRef.current;
    if (marker === null) return;
    const layers: MovableLayer[] = [marker];
    if (ringRef.current !== null) layers.push(ringRef.current);
    const from = marker.getLatLng();
    const jumpMeters = from.distanceTo([targetLat, targetLng]);
    if (jumpMeters < 0.1) return;
    const canAnimate =
      animate === true &&
      jumpMeters <= DR_SNAP_JUMP_METERS &&
      document.hidden === false &&
      prefersReducedMotion() === false;
    if (canAnimate) {
      moveLayersSmoothly(
        ship.id,
        layers,
        [from.lat, from.lng],
        [targetLat, targetLng],
        DR_LERP_DURATION_MS,
      );
    } else {
      snapLayers(ship.id, layers, [targetLat, targetLng]);
    }
  }, [ship.id, targetLat, targetLng, animate, isSelected]);

  useEffect(() => {
    return () => cancelTween(ship.id);
  }, [ship.id]);

  const handleClick = (): void => onSelect(ship.id);

  const visual = resolveShipVisual(ship, isSelected);
  // 표시 회전: TrueHeading 우선, 없으면 COG, 둘 다 없으면 0.
  // Display rotation: heading first, then COG, else 0.
  const rotation = quantizeHeading(ship.heading ?? ship.cog ?? 0);
  const icon = getShipIcon(visual, rotation, isSelected);

  const isVessel = ship.kind === "vessel";
  const speedText =
    speedUnit === "kmh"
      ? `${(ship.speed * 1.852).toFixed(1)} ${t("kmh", "km/h")}`
      : `${ship.speed.toFixed(1)} ${t("kn")}`;
  const cogText = ship.cog !== null ? `${Math.round(ship.cog)}°` : "—";
  const hdgText = ship.heading !== null ? `${Math.round(ship.heading)}°` : "—";
  const etaText = formatEta(ship.eta);
  const dimensionText =
    typeof ship.length === "number"
      ? `${ship.length} × ${typeof ship.width === "number" ? ship.width : "—"} m`
      : null;
  const draughtText =
    typeof ship.draught === "number" ? `${ship.draught.toFixed(1)} m` : null;
  const ageText = formatReportAge(ship.lastSeen);
  const categoryColor = getCategoryColor(ship.category);

  const courseVectorPositions: [number, number][] | null =
    showVector === true &&
    isVessel === true &&
    ship.cog !== null &&
    ship.speed >= COURSE_VECTOR_MIN_SOG_KN
      ? [
          [targetLat, targetLng],
          courseVectorEnd(targetLat, targetLng, ship.cog, ship.speed),
        ]
      : null;

  const statCell = (label: string, value: string): ReactElement => (
    <div className="bg-white/5 p-2 rounded border border-white/5 text-center">
      <span className="block text-[10px] text-slate-500 uppercase mb-1">
        {label}
      </span>
      {value}
    </div>
  );

  return (
    <Fragment>
      {isSelected === true && (
        <CircleMarker
          ref={ringRef}
          center={[targetLat, targetLng]}
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

      {courseVectorPositions !== null && (
        <Polyline
          positions={courseVectorPositions}
          interactive={false}
          pathOptions={{ color: visual.fill, weight: 1.5, opacity: 0.65 }}
        />
      )}

      <Marker
        ref={markerRef}
        position={mountPosition}
        icon={icon}
        zIndexOffset={isSelected === true ? 500 : 0}
        eventHandlers={{ click: handleClick }}
      >
        <Tooltip
          direction="top"
          offset={[0, -14]}
          opacity={0.95}
          className="ship-tooltip"
        >
          <span>
            {ship.name}
            {isVessel === true ? ` · ${speedText}` : ""}
          </span>
        </Tooltip>
        <Popup className="glass-popup">
          <div className="text-white min-w-[220px] p-1">
            <div className="border-b border-white/10 pb-2 mb-2 flex justify-between items-center gap-2">
              <span className="font-black text-xs uppercase tracking-widest text-indigo-400 truncate">
                {ship.name}
              </span>
              {isSelected === true && (
                <span className="shrink-0 text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 rounded border border-emerald-500/30">
                  {t("locked")}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mb-2 font-mono">
              {t("mmsi")}: {ship.id}
              {ship.callsign ? ` · ${ship.callsign}` : ""}
              {ship.imo ? ` · IMO ${ship.imo}` : ""}
            </p>

            <div className="flex flex-wrap gap-1 mb-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-slate-200">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: categoryColor }}
                />
                {t(getCategoryLabelKey(ship.category))}
              </span>
              {isVessel === true && (
                <span className="text-[10px] font-bold uppercase tracking-wide bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-slate-300">
                  {t(getNavStatusLabelKey(ship.navStatus))}
                </span>
              )}
            </div>

            {isVessel === true ? (
              <div className="grid grid-cols-2 gap-1.5 text-xs mb-2 font-bold">
                {statCell(t("currentSpeed"), speedText)}
                {statCell(t("cogLabel", "COG"), cogText)}
                {statCell(t("hdgLabel", "HDG"), hdgText)}
                {statCell(t("lastReport", "Last report"), ageText)}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1.5 text-xs mb-2 font-bold">
                {statCell(t("lastReport", "Last report"), ageText)}
              </div>
            )}

            {(ship.destination || etaText !== null) && (
              <div className="bg-white/5 border border-white/5 rounded p-2 mb-2 text-[11px] space-y-1">
                {ship.destination && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 uppercase text-[10px] font-bold">
                      {t("destination")}
                    </span>
                    <span className="font-bold text-right truncate">
                      {ship.destination}
                    </span>
                  </div>
                )}
                {etaText !== null && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 uppercase text-[10px] font-bold">
                      {t("etaLabel", "ETA")}
                    </span>
                    <span className="font-bold font-mono">{etaText} UTC</span>
                  </div>
                )}
              </div>
            )}

            {(dimensionText !== null || draughtText !== null) && (
              <p className="text-[10px] text-slate-400 mb-2 font-mono">
                {dimensionText !== null &&
                  `${t("dimensionsLabel", "Size")} ${dimensionText}`}
                {dimensionText !== null && draughtText !== null && " · "}
                {draughtText !== null &&
                  `${t("draughtLabel", "Draught")} ${draughtText}`}
              </p>
            )}

            <button
              onClick={handleClick}
              className={`w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                isSelected === true
                  ? "bg-indigo-500 text-white shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {isSelected === true ? t("trackingActive") : t("initializeLink")}
            </button>
          </div>
        </Popup>
      </Marker>

      {isSelected === true && showTrail === true && ship.path.length > 1 && (
        <Polyline
          positions={ship.path.map(
            (pathItem) => [pathItem.lat, pathItem.lng] as [number, number],
          )}
          interactive={false}
          pathOptions={{
            color: "#c084fc",
            weight: 2,
            dashArray: "4, 8",
            opacity: 0.8,
          }}
        />
      )}
    </Fragment>
  );
};

export const ShipMarker = memo(ShipMarkerBase, (prev, next): boolean => {
  // true 반환 = props 동일 → 리렌더 스킵.
  // Return true when nothing visible changed so React skips the re-render.
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.speedUnit !== next.speedUnit) return false;
  if (prev.showTrail !== next.showTrail) return false;
  if (prev.showVector !== next.showVector) return false;
  if (prev.animate !== next.animate) return false;
  if (prev.clockTick !== next.clockTick) return false;
  const a = prev.ship;
  const b = next.ship;
  if (a.position.lat !== b.position.lat || a.position.lng !== b.position.lng)
    return false;
  if (
    quantizeHeading(a.heading ?? a.cog ?? 0) !==
    quantizeHeading(b.heading ?? b.cog ?? 0)
  )
    return false;
  if (a.category !== b.category || a.kind !== b.kind) return false;
  if (a.navStatus !== b.navStatus) return false;
  if (a.inRestrictedZone !== b.inRestrictedZone) return false;
  if (a.risk?.severity !== b.risk?.severity) return false;
  if (a.name !== b.name || a.speed !== b.speed) return false;
  if (a.cog !== b.cog || a.heading !== b.heading) return false;
  if (a.destination !== b.destination || a.eta !== b.eta) return false;
  if (a.length !== b.length || a.width !== b.width) return false;
  if (a.draught !== b.draught) return false;
  if (a.callsign !== b.callsign || a.imo !== b.imo) return false;
  // 항적은 선택된 선박만 그리므로 선택 시에만 비교한다.
  // The trail only renders for the selected ship.
  if (next.isSelected && a.path !== b.path) return false;
  return true;
});
