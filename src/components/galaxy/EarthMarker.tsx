import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { EARTH_POSITION } from "./galaxyData";
import type { SpinRef } from "./rotation";

interface EarthMarkerProps {
  rotationSpeed?: number;
  spinRef?: SpinRef;
}

export function EarthMarker({ rotationSpeed = 0.03, spinRef }: EarthMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);

  // Pulse animation: time advances in useFrame and drives the halo opacity
  // there, so no ref value is read during render.
  const pulseRef = useRef({ time: 0 });
  const haloRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, delta) => {
    // Rotate with the galaxy
    if (groupRef.current) {
      if (spinRef) {
        groupRef.current.rotation.y = spinRef.current;
      } else {
        groupRef.current.rotation.y += delta * rotationSpeed;
      }
    }
    pulseRef.current.time += delta;
    if (haloRef.current) {
      const pulse = Math.sin(pulseRef.current.time * 1.5) * 0.3 + 0.7;
      haloRef.current.opacity = 0.2 * pulse;
    }
  });

  const [x, y, z] = EARTH_POSITION;

  return (
    <group ref={groupRef}>
      {/* Position marker at Earth's location */}
      <group position={[x, y, z]}>
        {/* Sol star glow — warm yellow */}
        <mesh>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#ffdd44" />
        </mesh>

        {/* Outer glow halo */}
        <mesh>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshBasicMaterial
            ref={haloRef}
            color="#ffaa33"
            transparent
            opacity={0.14}
            depthWrite={false}
          />
        </mesh>

        {/* Concentric orbit rings */}
        {[0.35, 0.55, 0.8].map((radius, i) => (
          <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[radius, radius + 0.008, 48]} />
            <meshBasicMaterial
              color="#ffdd4488"
              transparent
              opacity={0.15 * (1 - i * 0.35)}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        ))}

        {/* Pointing beam — subtle line toward galactic center */}
        <mesh rotation={[0, 0, Math.atan2(-x, -z)]}>
          <planeGeometry args={[0.008, 1.2]} />
          <meshBasicMaterial
            color="#ffdd44"
            transparent
            opacity={0.08}
            depthWrite={false}
          />
        </mesh>

        {/* "You are here" label */}
        <Html
          center
          distanceFactor={12}
          style={{
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <div className="flex flex-col items-center gap-0.5 animate-pulse">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-yellow-500/15 border border-yellow-400/30 backdrop-blur-sm">
              <span className="text-yellow-300 text-xs">☀</span>
              <span className="text-yellow-200/90 text-[10px] font-semibold whitespace-nowrap">
                Sol · You are here
              </span>
            </div>
            <span className="text-[8px] text-yellow-500/40 font-mono">
              Orion Spur
            </span>
          </div>
        </Html>
      </group>
    </group>
  );
}
