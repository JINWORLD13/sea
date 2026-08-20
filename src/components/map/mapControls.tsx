// 지도 보조 컨트롤: 재중심 이동, 선박 자동 맞춤, 뷰포트 추적, 베이스맵 전환.
// Map helper controls: recenter, auto-fit ships, viewport tracking, basemap switch.
import { useEffect, useRef } from "react";
import type { FC, ReactElement } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useTranslation } from "react-i18next";
import { useShipStore } from "../../store/useShipStore";
import type { RegionBounds, ShipData } from "../../store/useShipStore";
import { BASEMAP_ORDER } from "./basemaps";
import type { BasemapId } from "./basemaps";

interface RecenterProps {
  center: [number, number];
  regionId: string;
  zoom: number;
}

export const RecenterMap: FC<RecenterProps> = (props: RecenterProps): null => {
  const mapInstance = useMap();
  useEffect(() => {
    mapInstance.setView(props.center, props.zoom);
  }, [props.center, props.regionId, props.zoom, mapInstance]);
  return null;
};

interface AutoFitShipsProps {
  ships: ShipData[];
  regionId: string;
  regionBounds: RegionBounds;
  shouldSkip: boolean;
}

export const AutoFitShips: FC<AutoFitShipsProps> = ({
  ships,
  regionId,
  regionBounds,
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

    // 해역 박스 안의 선박만 맞춤 대상이다. 해역 전환 직후에는 스냅샷
    // 스로틀(700ms) 때문에 이전 해역 선박이 한 틱 더 렌더되는데, 그 배들로
    // fitBounds하면 지도가 이전 해역으로 되돌아가고, 이어지는 moveend가
    // AIS 구독까지 옛 뷰포트로 되감는다. 새 해역 선박이 실제로 도착할
    // 때까지 hasFittedRef도 세우지 않아 첫 자동 맞춤이 유실되지 않는다.
    // Only ships inside the region box qualify. Right after a region switch
    // the 700ms snapshot throttle renders the OLD region's ships for one more
    // tick; fitting to them flies the map back, and the resulting moveend
    // re-locks the AIS subscription onto the old viewport. hasFittedRef stays
    // unset until in-region ships actually arrive, so the first auto-fit for
    // the new region is never lost.
    const inRegion = ships.filter(
      (s) =>
        s.position.lat >= regionBounds[0] &&
        s.position.lat <= regionBounds[2] &&
        s.position.lng >= regionBounds[1] &&
        s.position.lng <= regionBounds[3],
    );
    if (inRegion.length === 0) return;

    if (inRegion.length === 1) {
      const only = inRegion[0];
      mapInstance.setView([only.position.lat, only.position.lng], 7);
      hasFittedRef.current = true;
      return;
    }

    const bounds = L.latLngBounds(
      inRegion.map((s) => [s.position.lat, s.position.lng] as [number, number]),
    );
    mapInstance.fitBounds(bounds, { padding: [32, 32], maxZoom: 6 });
    hasFittedRef.current = true;
  }, [ships, regionBounds, shouldSkip, mapInstance]);

  return null;
};

interface ViewportTrackerProps {
  onBoundsChange: (bounds: L.LatLngBounds) => void;
  onInteractionChange: (isInteracting: boolean) => void;
}

export const ViewportTracker: FC<ViewportTrackerProps> = ({
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

// 베이스맵 전환 컨트롤: settings.basemap / settings.seamarks를 읽어
// updateSettings로 저장한다(설정 페이지와 동일한 단일 소스).
// Basemap switcher control: reads settings.basemap / settings.seamarks and
// persists via updateSettings (same single source as the Settings page).
export const BasemapControl: FC = (): ReactElement => {
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
