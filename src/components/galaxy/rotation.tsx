import { useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Shared galaxy rotation.
//
// Every rotating piece of the model (galaxy points, prominent stars, Earth
// marker, star labels, the atlas map) reads the SAME angle from one ref, so
// they can never drift apart no matter when each component mounts. A single
// RotationDriver advances the angle once per frame.
// ---------------------------------------------------------------------------

export type SpinRef = { current: number };

export function RotationDriver({
  spinRef,
  speed,
}: {
  spinRef: SpinRef;
  speed: number;
}) {
  // Rendered as the first child inside the Canvas so every subscriber that
  // registers later reads the freshly-advanced angle within the same frame.
  useFrame((_, delta) => {
    if (speed !== 0) spinRef.current += delta * speed;
  });
  return null;
}

/** Wraps children in a group whose Y rotation tracks the shared spin angle
 *  (optionally scaled by a multiplier for differential rotation). */
export function RotGroup({
  spinRef,
  multiplier = 1,
  children,
}: {
  spinRef: SpinRef;
  multiplier?: number;
  children: ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = spinRef.current * multiplier;
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

/** Rotate a local (galaxy-space) point into world space for the current spin
 *  angle — used to compute stable camera fly-to targets. */
export function spinPoint(
  point: [number, number, number],
  angle: number,
): [number, number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [x, y, z] = point;
  return [x * c + z * s, y, -x * s + z * c];
}
