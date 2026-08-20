// 개별 선박 모델: 항해/정박 모션 및 시각 구분
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
// Same as dashboard: above 0.5 kn = sailing, below = moored.
const SPEED_MOORED_THRESHOLD = 0.5;

const Ship: FC<ShipProps> = (props: ShipProps): ReactElement => {
  const data: ShipData = props.data;
  const isSelected: boolean | undefined = props.isSelected;

  const shipRef = useRef<THREE.Group>(null);
  const anchorRef = useRef<THREE.Group>(null);
  const bobRef = useRef(0);
  const isPausedRef = useRef(false);
  // 흔들림(bob)과 분리된 기준 자세. lerp는 기준값에만 적용하고
  // bob은 매 프레임 그 위에 더해 누적 드리프트를 막는다.
  // Base attitude kept separate from the bob so the lerp targets a clean
  // value and the oscillation is layered on top each frame (no drift).
  const basePitchRef = useRef(0);
  const baseRollRef = useRef(0);
  // 현재 표시 중인 선수방위(rad). null이면 아직 첫 값을 못 받은 상태.
  // Yaw currently rendered (radians); null until the first value arrives.
  const currentYawRef = useRef<number | null>(null);

  const isMoving: boolean = data.speed > SPEED_MOORED_THRESHOLD;
  const isMoored: boolean = !isMoving;

  // 탭 전환·창 최소화 시 흔들림 일시정지, 다시 포커스하면 멈춘 시점부터 이어짐
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
    // 1) Pitch/roll interpolation (ship motion).
    const p = data.motion?.pitch ?? 0;
    const r = data.motion?.roll ?? 0;
    const intensity = 0.25;
    const targetPitch = ((p * Math.PI) / 180) * intensity;
    const targetRoll = ((r * Math.PI) / 180) * intensity;
    basePitchRef.current += (targetPitch - basePitchRef.current) * delta * 2;
    baseRollRef.current += (targetRoll - baseRollRef.current) * delta * 2;

    // 2) 헤딩(방향) 적용 — 지도 마커와 같은 규칙으로 heading 결측 시 COG 폴백.
    //    AIS 보고는 수 초 간격의 계단형이라 목표각까지 Lerp로 회전시키되,
    //    각도 차를 [-π, π]로 정규화해 359°→1°가 반대로 358° 돌지 않고
    //    항상 최단 방향으로 돌게 한다. 둘 다 결측이면 마지막 방위를 유지한다.
    // 2) Apply heading — COG fallback, same rule as the map markers. AIS
    //    reports arrive in multi-second steps, so lerp toward the target with
    //    the angular difference wrapped to [-π, π]: 359°→1° must turn the
    //    short way, not swing 358° backwards. With both fields missing the
    //    last known yaw is kept rather than fabricating due north.
    const headingDeg = data.heading ?? data.cog;
    if (headingDeg !== null) {
      const targetYaw = -(headingDeg * Math.PI) / 180;
      if (currentYawRef.current === null) {
        currentYawRef.current = targetYaw; // 첫 값은 스냅 / snap on first value
      } else {
        const TWO_PI = 2 * Math.PI;
        let diff = (targetYaw - currentYawRef.current) % TWO_PI;
        if (diff > Math.PI) diff -= TWO_PI;
        if (diff < -Math.PI) diff += TWO_PI;
        currentYawRef.current += diff * Math.min(1, delta * 2);
      }
    }
    ref.rotation.y = currentYawRef.current ?? 0;

    // 3) 수면 요동(바다 흔들림) 보간
    // 3) Wave bobbing (slight up/down and tilt).
    if (!isPausedRef.current) {
      bobRef.current += delta;
    }
    const t = bobRef.current;
    const bobY = Math.sin(t * 0.6) * 0.012;
    const bobRoll = Math.sin(t * 0.5) * 0.008;
    const bobPitch = Math.sin(t * 0.4) * 0.006;
    ref.position.y = bobY;
    ref.rotation.z = baseRollRef.current + bobRoll;
    ref.rotation.x = basePitchRef.current + bobPitch;

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
