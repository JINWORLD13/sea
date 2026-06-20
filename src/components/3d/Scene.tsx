// 3D 화면: 디버그 및 가시성 강화
// 3D画面：デバッグと可視性の強化
// 3D Scene: Debug & visibility.
import { Suspense, useRef, useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useShipStore } from "../../store/useShipStore";
import { useShipSnapshot } from "../../hooks/useShipSnapshot";

import Ship from "./Ship";

const Scene = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasSize, setHasSize] = useState(false);

  const ships = useShipSnapshot({ delayMs: 1000 });
  const selectedShipMmsi = useShipStore((state) => state.selectedShipMmsi);

  const selectedShip = selectedShipMmsi ? ships[selectedShipMmsi] : null;
  const shipList = Object.values(ships);
  const firstShip = shipList[0] ?? null;
  const displayShip = selectedShip ?? firstShip;

  // Canvas는 컨테이너가 실제 크기를 가진 뒤에만 마운트 (0x0이면 WebGL이 안 그려짐)
  // Canvasはコンテナに実サイズが付いてからマウント（0x0だとWebGLが描画されない）
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
