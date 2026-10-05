import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  getGalaxyData,
  generateNebulaPositions,
  generateDustPositions,
  seededNoise,
} from "./galaxyData";
import type { SpinRef } from "./rotation";

interface MilkyWayProps {
  onStarsReady?: (
    stars: ReturnType<typeof getGalaxyData>["prominentStars"],
  ) => void;
  rotationSpeed?: number;
  /** When provided, the galaxy reads its angle from this shared ref instead
   *  of accumulating its own, keeping every layer in lockstep. */
  spinRef?: SpinRef;
}

export function MilkyWay({
  onStarsReady,
  rotationSpeed = 0.03,
  spinRef,
}: MilkyWayProps) {
  const galaxyRef = useRef<THREE.Points>(null);
  const nebulaRef = useRef<THREE.Points>(null);
  const dustRef = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.Points>(null);
  const galaxyMat = useRef<THREE.ShaderMaterial>(null);
  const galaxyUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const galaxyData = useMemo(() => getGalaxyData(), []);

  useEffect(() => {
    onStarsReady?.(galaxyData.prominentStars);
  }, [onStarsReady, galaxyData]);

  useFrame((_, delta) => {
    if (galaxyMat.current) galaxyMat.current.uniforms.uTime.value += delta;
    if (spinRef) {
      const a = spinRef.current;
      if (galaxyRef.current) galaxyRef.current.rotation.y = a;
      if (nebulaRef.current) nebulaRef.current.rotation.y = a * 0.7;
      if (dustRef.current) dustRef.current.rotation.y = a * 0.85;
      if (glowRef.current) glowRef.current.rotation.y = a * 0.5;
      return;
    }
    const rot = delta * rotationSpeed;
    if (galaxyRef.current) galaxyRef.current.rotation.y += rot;
    if (nebulaRef.current) nebulaRef.current.rotation.y += rot * 0.7;
    if (dustRef.current) dustRef.current.rotation.y += rot * 0.85;
    if (glowRef.current) glowRef.current.rotation.y += rot * 0.5;
  });

  // --- Galaxy (stars) ---
  const galaxyGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(galaxyData.particles, 3),
    );
    geo.setAttribute(
      "color",
      new THREE.BufferAttribute(galaxyData.particleColors, 3),
    );
    geo.setAttribute(
      "size",
      new THREE.BufferAttribute(galaxyData.particleSizes, 1),
    );
    return geo;
  }, [galaxyData]);

  // --- HII / Nebula regions (pinkish-purple glow along arms) ---
  const nebulaPositions = useMemo(() => generateNebulaPositions(3000), []);
  const nebulaGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(nebulaPositions, 3),
    );
    return geo;
  }, [nebulaPositions]);

  // --- Dust lanes (dark absorbing patches between arms) ---
  const dustPositions = useMemo(() => generateDustPositions(4000), []);
  const dustGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(dustPositions, 3),
    );
    return geo;
  }, [dustPositions]);

  // --- Core glow (soft, large particles at center) ---
  const glowPositions = useMemo(() => {
    const count = 1000;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(seededNoise(i,1), 0.3) * 6;
      const theta = seededNoise(i,2) * Math.PI * 2;
      const phi = Math.acos(2 * seededNoise(i,3) - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi) * 0.3;
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return pos;
  }, []);
  const glowGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(glowPositions, 3));
    return geo;
  }, [glowPositions]);

  return (
    <>
      {/* ---- Main Galaxy Particle System ---- */}
      <points ref={galaxyRef} geometry={galaxyGeometry} frustumCulled={false}>
        <shaderMaterial
          ref={galaxyMat}
          vertexColors
          uniforms={galaxyUniforms}
          vertexShader={`attribute float size; varying vec3 vColor; varying float vBright; varying float vPhase;
            void main(){
              vColor = color;
              vBright = max(max(color.r, color.g), color.b);
              vPhase = fract(sin(dot(position, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
              vec4 p = modelViewMatrix * vec4(position, 1.0);
              gl_PointSize = clamp(size * 46.0 / max(0.01, -p.z), 2.0, 26.0);
              gl_Position = projectionMatrix * p;
            }`}
          fragmentShader={`uniform float uTime; varying vec3 vColor; varying float vBright; varying float vPhase;
            void main(){
              vec2 uv = gl_PointCoord - 0.5;
              float r = length(uv) * 2.0;
              if (r > 1.0) discard;
              float twinkle = 0.86 + 0.14 * sin(uTime * (0.6 + vPhase * 1.7) + vPhase * 6.2831);
              float core = exp(-r * r * 16.0);
              float halo = exp(-r * r * 3.4) * 0.55;
              float d = min(abs(uv.x), abs(uv.y));
              float glint = exp(-d * d * 420.0) * exp(-r * r * 1.6) * (0.12 + vBright * 0.5);
              vec3 col = vColor * (halo + glint) + vec3(1.0, 0.97, 0.9) * core;
              gl_FragColor = vec4(col * twinkle, (core + halo + glint) * twinkle);
            }`}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* ---- HII Regions / Nebulae (star-forming gas clouds) ---- */}
      <points ref={nebulaRef} geometry={nebulaGeometry} frustumCulled={false}>
        <pointsMaterial
          size={0.6}
          color="#cc66ff"
          transparent
          opacity={0.04}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
      {/* Second nebula layer — more orange/red for different regions */}
      <points
        ref={undefined}
        geometry={nebulaGeometry}
        frustumCulled={false}
      >
        <pointsMaterial
          size={0.5}
          color="#ff8844"
          transparent
          opacity={0.03}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* ---- Dust Lanes (dark areas between arms) ---- */}
      <points ref={dustRef} geometry={dustGeometry} frustumCulled={false}>
        <pointsMaterial
          size={0.3}
          color="#110000"
          transparent
          opacity={0.12}
          blending={THREE.MultiplyBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* ---- Galactic Core Glow ---- */}
      <points ref={glowRef} geometry={glowGeometry} frustumCulled={false}>
        <pointsMaterial
          size={0.5}
          color="#ffdd88"
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      {/* ---- Central core lights ---- */}
      <pointLight
        position={[0, 0, 0]}
        intensity={3}
        color="#ffdd77"
        distance={35}
      />
      <pointLight
        position={[0, 0, 0]}
        intensity={1.5}
        color="#ff8833"
        distance={20}
      />
    </>
  );
}
