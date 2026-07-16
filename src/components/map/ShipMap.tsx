// 선박 지도: 해역 내 선박들의 위치와 항적을 시각화합니다.
// 船舶地図：海域内の船舶の位置と航跡を視覚化します。
// Ship Map: Visualizes ship positions and paths in the region.
import type { ReactElement, FC } from "react";
import {
  Fragment,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  useShipStore,
  matchShipQuery,
  updateViewportSubscription,
} from "../../store/useShipStore";
import type { AppSettings, ShipData } from "../../store/useShipStore";
import {
  formatEta,
  getCategoryColor,
  getCategoryLabelKey,
  getNavStatusLabelKey,
} from "../../utils/aisTypes";
import { useTranslation } from "react-i18next";
import { useShipSnapshot } from "../../hooks/useShipSnapshot";
import {
  getClusterIcon,
  getReplayGhostIcon,
  getShipIcon,
  quantizeHeading,
  resolveShipVisual,
} from "./shipIcons";
import {
  cancelTween,
  moveLayersSmoothly,
  prefersReducedMotion,
  snapLayers,
} from "./markerAnimation";
import type { MovableLayer } from "./markerAnimation";
import { BASEMAPS, BASEMAP_ORDER, SEAMARK_OVERLAY } from "./basemaps";
import type { BasemapId } from "./basemaps";

const MAX_RENDERED_SHIPS = 250;

// 이 줌 이상에서는 개별 마커, 미만에서는 클러스터로 묶는다.
// このズーム以上では個別マーカー、未満ではクラスターにまとめる。
// At/above this zoom render individual markers; below it, cluster.
const CLUSTER_MAX_ZOOM = 12;
const CLUSTER_CELL_PX = 64;

// 침로 벡터: 선택 선박 또는 이 줌 이상에서, SOG 6분치 길이로 그린다.
// 針路ベクトル:選択船舶またはこのズーム以上で、SOG6分相当の長さで描く。
// Course vector: for the selected ship or at/above this zoom, drawn with a
// length equal to 6 minutes of travel at current SOG.
const COURSE_VECTOR_MIN_ZOOM = 13;
const COURSE_VECTOR_MIN_SOG_KN = 0.5;

// 데드레커닝 애니메이션 한계값: 큰 점프/저줌/다수 렌더 시에는 스냅한다.
// デッドレコニング・アニメーションのしきい値：大ジャンプ/低ズーム/大量レンダー時はスナップ。
// Dead-reckoning animation thresholds: snap on big jumps / low zoom / crowds.
const DR_LERP_DURATION_MS = 900;
const DR_SNAP_JUMP_METERS = 500;
const DR_MIN_ZOOM = 11;
const DR_MAX_ANIMATED_SHIPS = 150;

// 팝업의 "마지막 수신" 경과 표시를 주기적으로 갱신하는 틱 간격.
// ポップアップの「最終受信」経過表示を定期更新するティック間隔。
// Tick interval that refreshes the "last report" age shown in popups.
const REPORT_AGE_REFRESH_MS = 10_000;

// COG 방향으로 SOG 6분치(= sog kn × 1852 m × 0.1 h) 거리만큼 떨어진 지점.
// COG方向へSOG6分相当（= sog kn × 1852 m × 0.1 h）離れた地点。
// Point offset from the ship along COG by 6 minutes of travel at SOG.
const courseVectorEnd = (
  lat: number,
  lng: number,
  cogDeg: number,
  sogKnots: number,
): [number, number] => {
  const meters = sogKnots * 1852 * 0.1;
  const rad = (cogDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLng =
    Math.abs(cosLat) > 1e-6 ? (meters * Math.sin(rad)) / (111320 * cosLat) : 0;
  return [lat + dLat, lng + dLng];
};

// 마지막 AIS 수신 후 경과 시간을 "12s" / "4m 05s" / "2h 13m" 형태로 만든다.
// 最終AIS受信からの経過時間を「12s」/「4m 05s」/「2h 13m」形式にする。
// Format the age of the last AIS report ("12s" / "4m 05s" / "2h 13m").
const formatReportAge = (lastSeen: number | undefined): string => {
  if (typeof lastSeen !== "number") return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - lastSeen) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
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
  onInteractionChange: (isInteracting: boolean) => void;
}

const ViewportTracker: FC<ViewportTrackerProps> = ({
  onBoundsChange,
  onInteractionChange,
}): null => {
  const map = useMapEvents({
    movestart: () => {
      onInteractionChange(true);
    },
    zoomstart: () => {
      onInteractionChange(true);
    },
    moveend: () => {
      onBoundsChange(map.getBounds());
      onInteractionChange(false);
    },
    zoomend: () => {
      onBoundsChange(map.getBounds());
      onInteractionChange(false);
    },
  });

  useEffect(() => {
    onBoundsChange(map.getBounds());
  }, [map, onBoundsChange]);

  return null;
};

// 개별 선박 마커. memo로 감싸 위치/방향 등 실제 시각 정보가 바뀐 선박만
// 리렌더한다. 위치 이동은 공유 rAF 티커가 setLatLng로 보간하므로 React
// 리렌더는 아이콘/팝업 내용 갱신에만 쓰인다.
// 個別船舶マーカー。memoでラップし、位置/方位など実際の視覚情報が変わった船舶
// のみ再レンダーする。位置移動は共有rAFティッカーがsetLatLngで補間するため、
// React再レンダーはアイコン/ポップアップ内容の更新にのみ使われる。
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
  // 言語変更時にポップアップテキストが更新されるよう、マーカー内でtを購読する。
  // Subscribe to t inside the marker so popups update on language change.
  const { t } = useTranslation();
  // clockTick은 memo 비교를 깨뜨려 "마지막 수신" 경과 표시를 재계산시킨다.
  // clockTickはmemo比較を破って「最終受信」経過表示を再計算させる。
  // clockTick busts the memo comparison so the report age recomputes.
  void clockTick;

  const markerRef = useRef<L.Marker | null>(null);
  const ringRef = useRef<L.CircleMarker | null>(null);
  // 최초 마운트 위치. 이후 이동은 애니메이션 모듈이 setLatLng로 처리하므로
  // position prop을 고정해 React 경유의 즉시 스냅을 막는다.
  // 初回マウント位置。以降の移動はアニメーションモジュールがsetLatLngで処理する
  // ため、position propを固定してReact経由の即時スナップを防ぐ。
  // Position at mount time; afterwards the animation module owns movement via
  // setLatLng, so the prop stays stable to keep React from snapping it.
  // useStateの遅延初期化でマウント時点の位置を一度だけ捕捉する。以降の移動は
  // アニメーションモジュールがsetLatLngで担うためpropは固定され、React経由の
  // 即時スナップ(dead reckoningを無効化する)を防ぐ。refの描画中読み取りを避ける。
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
  // 表示回転:TrueHeading優先、なければCOG、両方なければ0。
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

const ShipMarker = memo(ShipMarkerBase, (prev, next): boolean => {
  // true 반환 = props 동일 → 리렌더 스킵.
  // true返却 = props同一 → 再レンダースキップ。
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
  // 航跡は選択船舶のみ描くため、選択時にのみ比較する。
  // The trail only renders for the selected ship.
  if (next.isSelected && a.path !== b.path) return false;
  return true;
});

interface ClusterInfo {
  id: string;
  lat: number;
  lng: number;
  count: number;
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

interface ClusterMarkerProps {
  cluster: ClusterInfo;
  onClick: (cluster: ClusterInfo) => void;
}

const ClusterMarker: FC<ClusterMarkerProps> = ({
  cluster,
  onClick,
}): ReactElement => (
  <Marker
    position={[cluster.lat, cluster.lng]}
    icon={getClusterIcon(cluster.count)}
    eventHandlers={{ click: () => onClick(cluster) }}
  />
);

// 선박 렌더 레이어. 줌인 시 개별 마커, 줌아웃 시 화면 픽셀 격자로 클러스터링한다.
// 선택된 선박은 항상 개별 표시(링/항적 유지). 패닝/줌 시 viewTick으로 재계산.
// 船舶レンダーレイヤー。ズームイン時は個別マーカー、ズームアウト時は画面ピクセル
// 格子でクラスタリング。選択船舶は常に個別表示（リング/航跡維持）。
// Ship render layer: individual markers when zoomed in, pixel-grid clusters
// when zoomed out. The selected ship always renders individually. viewTick
// recomputes clusters on pan/zoom (container-point projection changes).
interface ShipsLayerProps {
  ships: ShipData[];
  selectedShipMmsi: string | null;
  onSelect: (id: string) => void;
  speedUnit: AppSettings["speedUnit"];
  showTrails: boolean;
  showCourseVectors: boolean;
  clockTick: number;
}

const ShipsLayer: FC<ShipsLayerProps> = ({
  ships,
  selectedShipMmsi,
  onSelect,
  speedUnit,
  showTrails,
  showCourseVectors,
  clockTick,
}): ReactElement => {
  const map = useMap();
  const [viewTick, setViewTick] = useState<number>(0);
  useMapEvents({
    zoomend: () => setViewTick((n) => n + 1),
    moveend: () => setViewTick((n) => n + 1),
  });

  const layer = useMemo(() => {
    // viewTick은 패닝/줌 시 투영 좌표 재계산을 강제하기 위한 의존성이다.
    // viewTickはパン/ズーム時に投影座標の再計算を強制するための依存関係。
    // viewTick is a dependency that forces recompute when the projection moves.
    void viewTick;
    const zoom = map.getZoom();
    const selected =
      selectedShipMmsi !== null
        ? ships.find((s) => s.id === selectedShipMmsi) ?? null
        : null;

    if (zoom >= CLUSTER_MAX_ZOOM) {
      return { singles: ships, clusters: [] as ClusterInfo[], zoom };
    }

    interface Cell {
      ships: ShipData[];
      sumLat: number;
      sumLng: number;
      minLat: number;
      minLng: number;
      maxLat: number;
      maxLng: number;
    }
    const cells = new Map<string, Cell>();
    for (const ship of ships) {
      if (selected !== null && ship.id === selected.id) continue;
      const pt = map.latLngToContainerPoint([
        ship.position.lat,
        ship.position.lng,
      ]);
      const key =
        Math.floor(pt.x / CLUSTER_CELL_PX) +
        ":" +
        Math.floor(pt.y / CLUSTER_CELL_PX);
      let cell = cells.get(key);
      if (cell === undefined) {
        cell = {
          ships: [],
          sumLat: 0,
          sumLng: 0,
          minLat: ship.position.lat,
          minLng: ship.position.lng,
          maxLat: ship.position.lat,
          maxLng: ship.position.lng,
        };
        cells.set(key, cell);
      }
      cell.ships.push(ship);
      cell.sumLat += ship.position.lat;
      cell.sumLng += ship.position.lng;
      if (ship.position.lat < cell.minLat) cell.minLat = ship.position.lat;
      if (ship.position.lat > cell.maxLat) cell.maxLat = ship.position.lat;
      if (ship.position.lng < cell.minLng) cell.minLng = ship.position.lng;
      if (ship.position.lng > cell.maxLng) cell.maxLng = ship.position.lng;
    }

    const singles: ShipData[] = [];
    const clusters: ClusterInfo[] = [];
    if (selected !== null) singles.push(selected);
    for (const [key, cell] of cells) {
      if (cell.ships.length === 1) {
        singles.push(cell.ships[0]);
      } else {
        clusters.push({
          id: key,
          lat: cell.sumLat / cell.ships.length,
          lng: cell.sumLng / cell.ships.length,
          count: cell.ships.length,
          minLat: cell.minLat,
          minLng: cell.minLng,
          maxLat: cell.maxLat,
          maxLng: cell.maxLng,
        });
      }
    }
    return { singles, clusters, zoom };
    // viewTick: 패닝/줌 시 투영 좌표가 바뀌므로 재계산 트리거.
  }, [ships, selectedShipMmsi, map, viewTick]);

  // 클러스터 클릭 시 실제 구성 선박들의 경계로 화면을 맞춘다.
  // クラスタークリック時、実際の構成船舶の境界に画面を合わせる。
  // Cluster click fits the actual bounds of its member ships.
  const handleClusterClick = useCallback(
    (cluster: ClusterInfo): void => {
      const bounds = L.latLngBounds(
        [cluster.minLat, cluster.minLng],
        [cluster.maxLat, cluster.maxLng],
      );
      map.fitBounds(bounds, {
        padding: [48, 48],
        maxZoom: CLUSTER_MAX_ZOOM + 2,
        animate: prefersReducedMotion() === false,
      });
    },
    [map],
  );

  // 저줌이거나 화면에 마커가 너무 많으면 보간 대신 스냅한다.
  // 低ズームまたは画面上のマーカーが多すぎる場合、補間の代わりにスナップする。
  // Snap instead of tweening at low zoom or with too many rendered markers.
  const animationEnabled =
    layer.zoom >= DR_MIN_ZOOM && layer.singles.length <= DR_MAX_ANIMATED_SHIPS;

  return (
    <Fragment>
      {layer.singles.map((ship) => {
        const isSelected = selectedShipMmsi === ship.id;
        return (
          <ShipMarker
            key={ship.id}
            ship={ship}
            isSelected={isSelected}
            onSelect={onSelect}
            speedUnit={speedUnit}
            showTrail={showTrails}
            showVector={
              showCourseVectors === true &&
              (isSelected === true || layer.zoom >= COURSE_VECTOR_MIN_ZOOM)
            }
            animate={animationEnabled}
            clockTick={clockTick}
          />
        );
      })}
      {layer.clusters.map((cluster) => (
        <ClusterMarker
          key={"cluster_" + cluster.id}
          cluster={cluster}
          onClick={handleClusterClick}
        />
      ))}
    </Fragment>
  );
};

// 리플레이 고스트: 대시보드의 항적 스크럽이 만든 가상 위치를 보라색 펄스
// 마커 + 전체 항적 폴리라인으로 표시한다. 라이브 마커는 건드리지 않는다.
// リプレイゴースト：ダッシュボードの航跡スクラブが作った仮想位置を紫のパルス
// マーカー＋全航跡ポリラインで表示する。ライブマーカーには触れない。
// Replay ghost: renders the scrubbed position from the Dashboard as a pulsing
// violet marker plus the ship's full path polyline; the live marker is
// untouched.
interface ReplayGhostLayerProps {
  ships: Record<string, ShipData>;
}

const ReplayGhostLayer: FC<ReplayGhostLayerProps> = ({
  ships,
}): ReactElement | null => {
  const replayGhost = useShipStore((state) => state.replayGhost);
  if (replayGhost === null) return null;
  const ship: ShipData | undefined = ships[replayGhost.mmsi];
  return (
    <Fragment>
      {ship !== undefined && ship.path.length > 1 && (
        <Polyline
          positions={ship.path.map(
            (pathItem) => [pathItem.lat, pathItem.lng] as [number, number],
          )}
          interactive={false}
          pathOptions={{ color: "#8b5cf6", weight: 2, opacity: 0.55 }}
        />
      )}
      <Marker
        position={[replayGhost.lat, replayGhost.lng]}
        icon={getReplayGhostIcon()}
        interactive={false}
        zIndexOffset={1000}
      />
    </Fragment>
  );
};

// 베이스맵 전환 컨트롤: settings.basemap / settings.seamarks를 읽어
// updateSettings로 저장한다(설정 페이지와 동일한 단일 소스).
// ベースマップ切替コントロール:settings.basemap / settings.seamarksを読み、
// updateSettingsで保存する（設定ページと同一の単一ソース）。
// Basemap switcher control: reads settings.basemap / settings.seamarks and
// persists via updateSettings (same single source as the Settings page).
const BasemapControl: FC = (): ReactElement => {
  const { t } = useTranslation();
  const settings = useShipStore((state) => state.settings);
  const updateSettings = useShipStore((state) => state.updateSettings);

  const labels: Record<BasemapId, string> = {
    dark: t("basemapDark", "Dark"),
    light: t("basemapLight", "Light"),
    osm: t("basemapOsm", "Standard"),
    sat: t("basemapSat", "Satellite"),
  };

  return (
    <div className="absolute top-32 right-6 z-[1000] bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 p-2.5 shadow-2xl w-[148px]">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5 px-0.5">
        {t("mapLayers", "Layers")}
      </p>
      <div className="grid grid-cols-2 gap-1 mb-1.5">
        {BASEMAP_ORDER.map((id) => (
          <button
            key={id}
            onClick={() => updateSettings({ basemap: id })}
            className={`rounded-lg px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wide border transition-colors ${
              settings.basemap === id
                ? "bg-indigo-500/30 text-indigo-200 border-indigo-400/40"
                : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200"
            }`}
          >
            {labels[id]}
          </button>
        ))}
      </div>
      <button
        onClick={() => updateSettings({ seamarks: settings.seamarks === false })}
        className={`w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide border transition-colors ${
          settings.seamarks === true
            ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/30"
            : "bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200"
        }`}
      >
        <span>{t("seamarkOverlay", "Seamarks")}</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            settings.seamarks === true ? "bg-cyan-400" : "bg-slate-600"
          }`}
        />
      </button>
    </div>
  );
};

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
  // ポップアップの「最終受信」経過表示のための低頻度クロックティック。
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
    // 画面領域基準でAIS購読を更新（デバウンスはストアが処理）。
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
  // ストリーム状態 → オーバーレイ文言/色。「reconnecting」もそのまま表示する。
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
  // 艦隊モードが有効なら艦隊船舶のみ残す（検索/マリーナフィルターと結合）。
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
      // マリーナモード:7ノット未満で動く小型船（航路標識/基地局を除く）。
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
    // 境界を少し広げて、画面端でマーカーが突然消えないようにする。
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
  // レンダー上限にかかって隠れた船舶数（正直な「+N more」チップに使用）。
  // Ships hidden by the render cap (drives the honest "+N more" chip).
  const hiddenCount = Math.max(0, inViewShips.length - renderShips.length);

  // "감지된 선박" 카운트에서 항로표지(aton)/기지국(base)은 제외한다.
  // 「検知された船舶」カウントから航路標識(aton)/基地局(base)は除外する。
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
  // レンダーカバレッジ:画面に実際に描かれた比率（偽のスキャニングバーの代替）。
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
   * <div(コンテナ)>
   *  <MapContainer(マップ)>
   *    <TileLayer(ベースマップ)> + <TileLayer(航路標識オーバーレイ)>
   *    <RecenterMap /> <ViewportTracker /> <AutoFitShips />
   *    <ShipsLayer(マーカー/クラスター/針路ベクトル/航跡)>
   *    <ReplayGhostLayer(リプレイゴースト)>
   *  </MapContainer>
   *  <div(ステータスオーバーレイ)> <BasemapControl(レイヤーコントロール)>
   *  <div(+Nチップ)> <div(統計情報パネル)>
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
        海域オーバーレイ
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
