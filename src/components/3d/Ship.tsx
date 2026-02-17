// 개별 선박 모델: 항해/정박 모션 및 시각 구분
// 個別船舶モデル：航海/停泊モーションと視覚的区別
// Individual Ship Model: Sailing/Moored motion and visual distinction
import type { ReactElement, FC } from "react";
import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ShipData } from "../../store/useShipStore";

interface ShipProps {
  data: ShipData;
  isSelected?: boolean;
}

// 대시보드와 동일: 0.5노트 초과 = 항해 중, 이하 = 정박
// ダッシュボードと同様：0.5ノット超＝航海中、以下＝停泊
// Same as dashboard: above 0.5 kn = sailing, below = moored.
const SPEED_MOORED_THRESHOLD = 0.5;

const Ship: FC<ShipProps> = (props: ShipProps): ReactElement => {
  const data: ShipData = props.data;
  const isSelected: boolean | undefined = props.isSelected;

  const shipRef = useRef<THREE.Group>(null);
  const anchorRef = useRef<THREE.Group>(null);
  const bobRef = useRef(0);
  const isPausedRef = useRef(false);

  const isMoving: boolean = data.speed > SPEED_MOORED_THRESHOLD;
  const isMoored: boolean = !isMoving;

  // 탭 전환·창 최소화 시 흔들림 일시정지, 다시 포커스하면 멈춘 시점부터 이어짐
  // タブ切替・最小化で揺れ一時停止、フォーカス戻すと再開
  // Pause motion when tab hidden; resume from same state on focus.
  useEffect(() => {
    const onVisibilityChange = () => {
      isPausedRef.current = document.visibilityState === "hidden";
    };
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useFrame((_state, delta: number) => {
    const ref = shipRef.current;
    if (ref === null) return;

    // 1) 피치·롤 보간 (선박 흔들림)
    // 1) ピッチ・ロール補間（船の揺れ）
    // 1) Pitch/roll interpolation (ship motion).
    const p = data.motion?.pitch ?? 0;
    const r = data.motion?.roll ?? 0;
    const intensity = 0.25;
    const targetPitch = ((p * Math.PI) / 180) * intensity;
    const targetRoll = ((r * Math.PI) / 180) * intensity;
    ref.rotation.x += (targetPitch - ref.rotation.x) * delta * 2;
    ref.rotation.z += (targetRoll - ref.rotation.z) * delta * 2;

    // 2) 헤딩(방향) 적용
    // 2) ヘディング（方向）を適用
    // 2) Apply heading (direction).
    const headingDeg = data.heading || 0;
    const targetHeading = (headingDeg * Math.PI) / 180;
    ref.rotation.y = -targetHeading;

    // 3) 수면 요동(바다 흔들림) 보간
    // 3) 水面のうねり（海の揺れ）補間
    // 3) Wave bobbing (slight up/down and tilt).
    if (!isPausedRef.current) {
      bobRef.current += delta;
    }
    const t = bobRef.current;
    const bobY = Math.sin(t * 0.6) * 0.012;
    const bobRoll = Math.sin(t * 0.5) * 0.008;
    const bobPitch = Math.sin(t * 0.4) * 0.006;
    ref.position.y = bobY;
    ref.rotation.z += bobRoll;
    ref.rotation.x += bobPitch;

    if (anchorRef.current && isMoored) {
      anchorRef.current.rotation.z = Math.sin(t * 0.4) * 0.02;
    }
  });

  const hullColor = isSelected ? "#818cf8" : isMoored ? "#f59e0b" : "#ffffff";
  const markerColor = isSelected ? "#c084fc" : isMoored ? "#fbbf24" : "#ffffff";

  return (
    <group>
      <group ref={shipRef}>
        {/* 선체 */}
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[4, 2, 10]} />
          <meshStandardMaterial
            color={hullColor}
            roughness={0.1}
            metalness={0.1}
            emissive={isSelected ? "#222244" : isMoored ? "#422000" : "#000000"}
          />
        </mesh>

        {/* 선수부 */}
        <mesh position={[0, 2, 6]} rotation={[0, Math.PI / 4, 0]}>
          <boxGeometry args={[2.828, 2, 2.828]} />
          <meshStandardMaterial
            color={hullColor}
            roughness={0.1}
            metalness={0.1}
          />
        </mesh>

        {/* 선교(메인 브릿지): 갑판(y=3)에 딱 붙임 */}
        <group position={[0, 3, -2]}>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[3, 3, 3]} />
            <meshBasicMaterial
              color={isSelected ? "#c084fc" : isMoored ? "#f59e0b" : "#ff4444"}
            />
          </mesh>
        </group>

        {/* 탑브릿지: 선교 상단에 딱 붙임 */}
        <group position={[0, 6, -2]}>
          <mesh position={[0, 0.6, 0]}>
            <boxGeometry args={[2, 1.2, 2]} />
            <meshBasicMaterial
              color={isSelected ? "#a78bfa" : isMoored ? "#fbbf24" : "#ff6666"}
            />
          </mesh>
        </group>

        {/* 상태 마커(구): 탑브릿지 상단에 선체와 일체화 */}
        <mesh position={[0, 8, -2]}>
          <sphereGeometry args={[0.8, 16, 16]} />
          <meshBasicMaterial color={markerColor} />
        </mesh>

        {/* 정박 시: 닻 + 사슬 (선미 아래, 선박 좌표계) */}
        {isMoored && (
          <group ref={anchorRef} position={[0, -2, -6]}>
            {/* 사슬 */}
            <mesh position={[0, 2, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 5, 8]} />
              <meshStandardMaterial color="#4a4a4a" metalness={0.8} roughness={0.4} />
            </mesh>
            {/* 닻 막대 */}
            <mesh position={[0, -0.5, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 2.2, 8]} />
              <meshStandardMaterial color="#5a5a5a" metalness={0.7} roughness={0.5} />
            </mesh>
            {/* 닻 양쪽 팔 */}
            <mesh position={[0.5, -1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, 1, 6]} />
              <meshStandardMaterial color="#5a5a5a" metalness={0.7} roughness={0.5} />
            </mesh>
            <mesh position={[-0.5, -1.4, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, 1, 6]} />
              <meshStandardMaterial color="#5a5a5a" metalness={0.7} roughness={0.5} />
            </mesh>
            {/* 닻 끝(화살) */}
            <mesh position={[0, -2.2, 0]}>
              <coneGeometry args={[0.2, 0.5, 6]} />
              <meshStandardMaterial color="#5a5a5a" metalness={0.7} roughness={0.5} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
};

export default Ship;
