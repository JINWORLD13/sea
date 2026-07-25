// 데드레커닝 마커 애니메이션: 모든 마커가 하나의 rAF 티커를 공유하며,
// React 리렌더 없이 Leaflet setLatLng로 표시 위치를 목표 위치까지 보간한다.
// Dead-reckoning marker animation: every marker shares a single rAF ticker and
// interpolates displayed -> target position via Leaflet setLatLng, with no
// per-frame React re-render.
import type { LatLngExpression } from "leaflet";

// setLatLng만 있으면 어떤 Leaflet 레이어든 움직일 수 있다(Marker, CircleMarker 등).
// Anything with setLatLng can be tweened (Marker, CircleMarker, ...).
export interface MovableLayer {
  setLatLng: (latlng: LatLngExpression) => unknown;
}

interface ActiveTween {
  layers: MovableLayer[];
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  startedAt: number;
  duration: number;
}

const tweens = new Map<string, ActiveTween>();
let rafId: number | null = null;
let reducedMotionQuery: MediaQueryList | null = null;

// 사용자 OS의 "모션 줄이기" 설정. MQL은 한 번만 생성해 재사용한다.
// OS-level prefers-reduced-motion; the MediaQueryList is created once.
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  if (reducedMotionQuery === null) {
    reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  }
  return reducedMotionQuery.matches;
};

const stopTicker = (): void => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
};

const step = (now: number): void => {
  rafId = null;
  for (const [key, tween] of tweens) {
    const progress = Math.min((now - tween.startedAt) / tween.duration, 1);
    const lat = tween.fromLat + (tween.toLat - tween.fromLat) * progress;
    const lng = tween.fromLng + (tween.toLng - tween.fromLng) * progress;
    for (const layer of tween.layers) {
      layer.setLatLng([lat, lng]);
    }
    if (progress >= 1) {
      tweens.delete(key);
    }
  }
  if (tweens.size > 0) {
    rafId = requestAnimationFrame(step);
  }
};

const ensureTicker = (): void => {
  if (rafId === null) {
    rafId = requestAnimationFrame(step);
  }
};

// 표시 위치(from)에서 목표 위치(to)까지 duration 동안 선형 보간한다.
// 같은 key로 다시 호출하면 기존 트윈을 대체한다(최신 목표 우선).
// Lerp displayed (from) -> target (to) over duration. Re-invoking with the
// same key replaces the running tween (latest target wins).
export const moveLayersSmoothly = (
  key: string,
  layers: MovableLayer[],
  from: [number, number],
  to: [number, number],
  duration: number,
): void => {
  tweens.set(key, {
    layers,
    fromLat: from[0],
    fromLng: from[1],
    toLat: to[0],
    toLng: to[1],
    startedAt: performance.now(),
    duration,
  });
  ensureTicker();
};

// 애니메이션 없이 즉시 목표 위치로 스냅한다(대점프/저줌/다수 렌더 시).
// Snap straight to the target position (large jump / low zoom / many ships).
export const snapLayers = (
  key: string,
  layers: MovableLayer[],
  to: [number, number],
): void => {
  tweens.delete(key);
  for (const layer of layers) {
    layer.setLatLng(to);
  }
};

// 마커 언마운트 시 잔여 트윈을 정리한다.
// Drop a pending tween when its marker unmounts.
export const cancelTween = (key: string): void => {
  tweens.delete(key);
};

// 탭이 백그라운드로 가면 rAF가 멈추므로, 진행 중인 트윈을 목표 지점으로
// 즉시 스냅해 복귀 시 마커가 과거 위치에 남지 않게 한다.
// When the tab is hidden rAF stalls, so finish all tweens immediately to avoid
// stale marker positions on return.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", (): void => {
    if (document.hidden === false) return;
    for (const [, tween] of tweens) {
      for (const layer of tween.layers) {
        layer.setLatLng([tween.toLat, tween.toLng]);
      }
    }
    tweens.clear();
    stopTicker();
  });
}
