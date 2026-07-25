// 3D 화면: 디버그 및 가시성 강화
// 3D Scene: Debug & visibility.
import { Suspense, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useShipStore } from "../../store/useShipStore";
import type { ShipData, ShipStore } from "../../store/useShipStore";

import Ship from "./Ship";

// 3D 뷰는 한 척만 그리므로 전체 선박 스냅샷을 구독하지 않는다. 표시 대상
// 한 척만 셀렉터로 뽑으면, 그 배가 실제로 갱신됐을 때만 리렌더가 발생한다
// (스냅샷 구독은 다른 499척이 움직여도 매초 리렌더를 유발했다).
// The 3D view renders a single vessel, so it must not subscribe to the whole
// ship snapshot. Selecting just the displayed vessel means a re-render happens
// only when THAT vessel changes — the snapshot subscription used to re-render
// every second even when only the other 499 ships had moved.
const selectDisplayShip = (state: ShipStore): ShipData | null => {
  const selectedId = state.selectedShipMmsi;
  if (selectedId !== null) {
    const selected = state.ships[selectedId];
    if (selected !== undefined) return selected;
  }
  // 선택이 없으면 첫 선박으로 폴백한다. MMSI는 정수형 문자열 키라 열거 순서가
  // 안정적이므로, 기존 Object.values(ships)[0]과 같은 배를 고른다.
  // Fall back to the first ship. MMSI keys are integer-like strings, so
  // enumeration order is stable and this picks the same vessel as before.
  for (const id in state.ships) return state.ships[id];
  return null;
};

const Scene = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasSize, setHasSize] = useState(false);

  const selectedShipMmsi = useShipStore((state) => state.selectedShipMmsi);
  const displayShip = useShipStore(selectDisplayShip);

  // Canvas는 컨테이너가 실제 크기를 가진 뒤에만 마운트 (0x0이면 WebGL이 안 그려짐)
  // Mount Canvas only after container has real size (no WebGL render at 0x0).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      const { width, height } = el.getBoundingClientRect();
      setHasSize((prev) => (width > 0 && height > 0) || prev);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      id="three-scene-container"
      className="w-full h-full min-h-[280px] bg-[#1a1c23] relative"
      style={{ minHeight: "280px" }}
    >
      {hasSize && <Canvas
        shadows
        camera={{ position: [20, 20, 20], fov: 50 }}
        className="!w-full !h-full"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          display: "block",
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#16191f"]} />
        <ambientLight intensity={1.5} />
        <pointLight position={[20, 20, 20]} intensity={3} />
        <directionalLight position={[-10, 20, 10]} intensity={2} />
        <gridHelper args={[100, 20, "#444466", "#222233"]} />
        <Suspense fallback={null}>
          {displayShip && (
            <Ship
              data={displayShip}
              isSelected={selectedShipMmsi === displayShip.id}
            />
          )}
          <OrbitControls makeDefault />
        </Suspense>
      </Canvas>}

      {!hasSize && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs">
          Loading 3D...
        </div>
      )}

      {!displayShip && hasSize && (
        <div className="relative z-10 text-center pointer-events-none">
          <p className="text-sm font-black text-indigo-400/50 uppercase tracking-[0.3em]">
            Select Object from Radar
          </p>
        </div>
      )}
    </div>
  );
};

export default Scene;
