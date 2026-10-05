import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RotGroup, type SpinRef } from "./rotation";

interface StarLabelProps {
  position: [number, number, number];
  name: string;
  isSelected: boolean;
  isHovered: boolean;
  /** Shared galaxy angle so the label tracks its rotating star */
  spinRef?: SpinRef;
}

export function StarLabel({
  position,
  name,
  isSelected,
  isHovered,
  spinRef,
}: StarLabelProps) {
  if (!isSelected && !isHovered) return null;

  const body = (
    <group position={position}>
      {/* Glow ring */}
      <mesh>
        <ringGeometry args={[0.08, 0.15, 16]} />
        <meshBasicMaterial
          color={isSelected ? "#66ff66" : "#ffffff"}
          transparent
          opacity={isSelected ? 0.8 : 0.5}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* HTML Label */}
      <Html
        center
        distanceFactor={15}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          transform: "translateY(20px)",
        }}
      >
        <div
          className={`
            px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
            transition-all duration-200
            ${isSelected
              ? "bg-green-500/20 border border-green-400/50 text-green-300 shadow-lg shadow-green-500/20"
              : "bg-white/10 border border-white/20 text-white/90 backdrop-blur-sm"
            }
          `}
        >
          {name}
        </div>
      </Html>
    </group>
  );

  if (spinRef) {
    return <RotGroup spinRef={spinRef}>{body}</RotGroup>;
  }
  return body;
}
