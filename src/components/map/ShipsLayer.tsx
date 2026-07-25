// 선박 레이어: 줌에 따라 개별 마커/클러스터 전환, 침로 벡터·항적, 리플레이 고스트.
// Ships layer: individual markers vs clusters by zoom, course vectors & trails, replay ghost.
import { Fragment, useCallback, useMemo, useState } from "react";
import type { FC, ReactElement } from "react";
import { Marker, Polyline, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useShipStore } from "../../store/useShipStore";
import type { AppSettings, ShipData } from "../../store/useShipStore";
import { getClusterIcon, getReplayGhostIcon } from "./shipIcons";
import { prefersReducedMotion } from "./markerAnimation";
import { ShipMarker } from "./ShipMarker";
import {
  CLUSTER_CELL_PX,
  CLUSTER_MAX_ZOOM,
  COURSE_VECTOR_MIN_ZOOM,
  DR_MAX_ANIMATED_SHIPS,
  DR_MIN_ZOOM,
} from "./mapShared";

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

export const ShipsLayer: FC<ShipsLayerProps> = ({
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
// Replay ghost: renders the scrubbed position from the Dashboard as a pulsing
// violet marker plus the ship's full path polyline; the live marker is
// untouched.
interface ReplayGhostLayerProps {
  ships: Record<string, ShipData>;
}

export const ReplayGhostLayer: FC<ReplayGhostLayerProps> = ({
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
