// 선박 아이콘 팩토리: 선종(category)·항해상태·위험도에 따라 모양과 색을
// 결정하고 DivIcon을 캐싱한다. 우선순위: 선택 > 위험 > 제한구역(외곽선) > 선종.
// 船舶アイコンファクトリ：船種（category）・航海状態・リスクに応じて形状と色を
// 決定し、DivIconをキャッシュする。優先順位：選択 > リスク > 制限区域（輪郭） > 船種。
// Ship icon factory: derives shape and color from category, nav status and
// risk, with DivIcon caching. Priority: selected > risk > restricted
// (outline only) > category fill.
import L from "leaflet";
import type { DivIcon } from "leaflet";
import type { ShipData } from "../../store/useShipStore";
import { getCategoryColor, isStationaryStatus } from "../../utils/aisTypes";

const ICON_CACHE_LIMIT = 2000;
const iconCache = new Map<string, DivIcon>();
const clusterIconCache = new Map<string, DivIcon>();

// 방향(heading) 양자화 각도. 작은 각도 변화로 인한 마커/아이콘 재생성을 억제한다.
// 方位（heading）の量子化角度。小さな角度変化によるマーカー/アイコン再生成を抑制する。
// Quantize heading so sub-threshold rotation changes don't churn markers/icons.
const HEADING_QUANT = 3;
export const quantizeHeading = (heading: number): number =>
  Math.round(heading / HEADING_QUANT) * HEADING_QUANT;

// 모양 규칙: 항행 중 선박=삼각형, 정박/계류/좌초=원, AtoN=마름모 외곽선,
// 기지국=사각형 외곽선.
// 形状ルール:航行中の船舶=三角形、錨泊/係留/座礁=円、AtoN=菱形の輪郭、
// 基地局=四角形の輪郭。
// Shape rules: underway vessel = triangle, anchored/moored/aground = circle,
// aid-to-navigation = diamond outline, base station = square outline.
export type ShipIconShape = "triangle" | "circle" | "diamond" | "square";

export interface ShipVisual {
  shape: ShipIconShape;
  fill: string;
  glow: string;
  restricted: boolean;
}

const hexToRgba = (hex: string, alpha: number): string => {
  const value = parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 선박의 시각 속성(모양/채움색/글로우/제한구역 외곽선)을 결정한다.
// 船舶の視覚属性（形状/塗り色/グロー/制限区域の輪郭）を決定する。
// Resolve the visual attributes (shape / fill / glow / restricted outline).
export const resolveShipVisual = (
  ship: ShipData,
  isSelected: boolean,
): ShipVisual => {
  const shape: ShipIconShape =
    ship.kind === "aton"
      ? "diamond"
      : ship.kind === "base"
        ? "square"
        : isStationaryStatus(ship.navStatus)
          ? "circle"
          : "triangle";

  const severity = ship.risk?.severity;
  let fill: string;
  if (severity === "danger") {
    fill = "#f87171";
  } else if (severity === "warning") {
    fill = "#fbbf24";
  } else if (isSelected === true) {
    fill = "#c084fc";
  } else {
    fill = getCategoryColor(ship.category);
  }

  // 제한구역은 선종 채움색을 유지한 채 주황색 외곽선/글로우만 추가한다.
  // 制限区域は船種の塗り色を維持したまま、オレンジの輪郭/グローのみ追加する。
  // Restricted zone keeps the category fill; only an orange outline/glow.
  const restricted = ship.inRestrictedZone === true;
  let glow: string;
  if (severity === "danger") {
    glow = "rgba(248, 113, 113, 0.8)";
  } else if (severity === "warning") {
    glow = "rgba(251, 191, 36, 0.6)";
  } else if (restricted === true) {
    glow = "rgba(249, 115, 22, 0.6)";
  } else if (isSelected === true) {
    glow = "rgba(192, 132, 252, 0.6)";
  } else {
    glow = hexToRgba(fill, 0.35);
  }

  return { shape, fill, glow, restricted };
};

const shapeSvg = (shape: ShipIconShape, fill: string): string => {
  if (shape === "circle") {
    return `
      <circle cx="12" cy="12" r="4.6" fill="${fill}" fill-opacity="0.35" stroke="${fill}" stroke-width="1.5" />
      <circle cx="12" cy="12" r="1.6" fill="${fill}" />`;
  }
  if (shape === "diamond") {
    return `
      <path d="M12 5.4 L18.6 12 L12 18.6 L5.4 12 Z" fill="none" stroke="${fill}" stroke-width="1.6" stroke-linejoin="round" />
      <circle cx="12" cy="12" r="1.3" fill="${fill}" />`;
  }
  if (shape === "square") {
    return `
      <rect x="7.4" y="7.4" width="9.2" height="9.2" fill="none" stroke="${fill}" stroke-width="1.6" />
      <circle cx="12" cy="12" r="1.3" fill="${fill}" />`;
  }
  // 삼각형(선수 방향 화살촉). 회전은 래퍼 div에서 적용한다.
  // 三角形（船首方向の矢じり）。回転はラッパーdivで適用する。
  // Triangle (bow-pointing arrowhead); rotation is applied on the wrapper div.
  return `
    <path d="M12 4.6 L17.2 18 L12 15.4 L6.8 18 Z" fill="${fill}" fill-opacity="0.3" stroke="${fill}" stroke-width="1.5" stroke-linejoin="round" />`;
};

// DivIcon 생성 + FIFO 캐시. 회전은 삼각형에만 의미가 있으므로 캐시 키에서
// 다른 모양은 0으로 고정해 캐시 적중률을 높인다.
// DivIcon生成＋FIFOキャッシュ。回転は三角形にのみ意味があるため、他の形状は
// キャッシュキーで0に固定してヒット率を高める。
// Create + FIFO-cache the DivIcon. Rotation only matters for triangles, so
// other shapes pin it to 0 in the cache key for better hit rates.
export const getShipIcon = (
  visual: ShipVisual,
  rotation: number,
  isSelected: boolean,
): DivIcon => {
  const appliedRotation = visual.shape === "triangle" ? rotation : 0;
  const cacheKey = [
    visual.shape,
    appliedRotation,
    visual.fill,
    isSelected ? 1 : 0,
    visual.restricted ? 1 : 0,
  ].join("|");
  const cached = iconCache.get(cacheKey);
  if (cached) return cached;

  const baseSize =
    visual.shape === "diamond" || visual.shape === "square" ? 34 : 40;
  const size = isSelected === true ? baseSize + 8 : baseSize;

  const restrictedRing =
    visual.restricted === true
      ? `<circle cx="12" cy="12" r="10.4" fill="none" stroke="#f97316" stroke-width="1.3" stroke-dasharray="3 2.4" opacity="0.9" />`
      : "";

  const html = `
    <div style="transform: rotate(${appliedRotation}deg); width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; transition: transform 0.25s ease;">
      <svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" style="filter: drop-shadow(0 0 6px ${visual.glow});">
        ${restrictedRing}
        ${shapeSvg(visual.shape, visual.fill)}
      </svg>
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: "ship-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

  // 캐시 무한 증가 방지: 상한 초과 시 가장 오래된 항목 제거(간단한 FIFO).
  // キャッシュの無限増加防止：上限超過時に最も古い項目を削除（単純なFIFO）。
  // Prevent unbounded cache growth: evict oldest entry past the limit (FIFO).
  if (iconCache.size >= ICON_CACHE_LIMIT) {
    const oldestKey = iconCache.keys().next().value;
    if (oldestKey !== undefined) iconCache.delete(oldestKey);
  }
  iconCache.set(cacheKey, icon);
  return icon;
};

// 클러스터 아이콘(선박 수에 따라 크기/색 단계).
// クラスターアイコン（隻数に応じてサイズ/色の段階）。
// Cluster icon, sized/tinted by vessel count.
export const getClusterIcon = (count: number): DivIcon => {
  const cacheKey = String(count);
  const cached = clusterIconCache.get(cacheKey);
  if (cached) return cached;

  const size = count < 10 ? 36 : count < 50 ? 46 : count < 200 ? 56 : 64;
  const bg =
    count < 10
      ? "rgba(99, 102, 241, 0.85)"
      : count < 50
        ? "rgba(139, 92, 246, 0.88)"
        : "rgba(217, 70, 239, 0.9)";
  const html = `
    <div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;border-radius:9999px;background:${bg};border:2px solid rgba(255,255,255,0.55);box-shadow:0 0 14px rgba(99,102,241,0.55);color:#fff;font-weight:900;font-family:ui-monospace,SFMono-Regular,monospace;font-size:${size < 46 ? 12 : 13}px;">${count}</div>
  `;
  const icon = L.divIcon({
    html,
    className: "ship-cluster-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  if (clusterIconCache.size >= 512) {
    const oldest = clusterIconCache.keys().next().value;
    if (oldest !== undefined) clusterIconCache.delete(oldest);
  }
  clusterIconCache.set(cacheKey, icon);
  return icon;
};

// 리플레이 고스트 아이콘: 보라색 반투명 + 펄스 링(CSS는 ShipMap 스타일 블록).
// リプレイゴーストアイコン：紫の半透明＋パルスリング（CSSはShipMapのスタイルブロック）。
// Replay ghost icon: violet, semi-transparent with a pulsing ring (CSS lives
// in the ShipMap style block).
let replayGhostIcon: DivIcon | null = null;
export const getReplayGhostIcon = (): DivIcon => {
  if (replayGhostIcon !== null) return replayGhostIcon;
  replayGhostIcon = L.divIcon({
    html: `<div class="replay-ghost"><span class="replay-ghost-ring"></span><span class="replay-ghost-dot"></span></div>`,
    className: "replay-ghost-icon",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
  return replayGhostIcon;
};
