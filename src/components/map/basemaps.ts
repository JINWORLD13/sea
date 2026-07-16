// 베이스맵 정의: 설정(settings.basemap / settings.seamarks)에 따라 지도가
// 사용할 타일 URL과 저작자 표시(attribution)를 한 곳에서 관리한다.
// ベースマップ定義：設定（settings.basemap / settings.seamarks）に応じて地図が
// 使用するタイルURLと帰属表示（attribution）を一元管理する。
// Basemap definitions: single source of truth for tile URLs and attributions
// driven by settings.basemap / settings.seamarks.

export type BasemapId = "dark" | "light" | "osm" | "sat";

export interface BasemapDefinition {
  id: BasemapId;
  url: string;
  attribution: string;
  maxZoom: number;
  // 타일이 없는 영역에 보이는 지도 배경색(다크/라이트 지도에 맞춤).
  // タイルのない領域に見える地図の背景色（ダーク/ライト地図に合わせる）。
  // Map background behind missing tiles, matched to the tile style.
  background: string;
}

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export const BASEMAP_ORDER: readonly BasemapId[] = [
  "dark",
  "light",
  "osm",
  "sat",
];

export const BASEMAPS: Record<BasemapId, BasemapDefinition> = {
  dark: {
    id: "dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
    background: "#0b0e14",
  },
  light: {
    id: "light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: CARTO_ATTRIBUTION,
    maxZoom: 20,
    background: "#dfe4ea",
  },
  osm: {
    id: "osm",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    background: "#dfe4ea",
  },
  sat: {
    id: "sat",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution:
      "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
    background: "#02060d",
  },
};

// OpenSeaMap 항로표지(seamark) 오버레이. 베이스맵 위에 겹쳐 그린다.
// OpenSeaMap航路標識（seamark）オーバーレイ。ベースマップの上に重ねて描く。
// OpenSeaMap seamark overlay, rendered on top of the active basemap.
export const SEAMARK_OVERLAY = {
  url: "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openseamap.org/">OpenSeaMap</a> contributors',
  maxZoom: 18,
} as const;
