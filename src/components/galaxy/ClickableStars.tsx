import { memo, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";
import { starRadius, type StarData } from "./galaxyData";
import type { SpinRef } from "./rotation";

const vertexShader = `
  varying vec3 vLocal; varying vec3 vNormal; varying vec3 vView;
  void main() {
    vLocal = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal); vView = normalize(-p.xyz);
    gl_Position = projectionMatrix * p;
  }
`;
const fragmentShader = `
  uniform vec3 uColor; uniform float uTime;
  varying vec3 vLocal; varying vec3 vNormal; varying vec3 vView;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
  float noise(vec3 p) {
    vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main() {
    vec3 p=vLocal*35.0+vec3(uTime*0.3,0,0);
    float grains=noise(p)*0.55+noise(p*2.1)*0.3+noise(p*4.0)*0.15;
    float spots=smoothstep(0.7,0.85,noise(vLocal*7.0+uTime*0.03));
    float limb=pow(max(dot(normalize(vNormal),normalize(vView)),0.0),0.35);
    vec3 color=uColor*(0.6+grains*0.7)*(1.0-spots*0.5)*(0.55+0.45*limb);
    gl_FragColor=vec4(color,1.0);
  }
`;
const coronaShader = `
  uniform vec3 uColor; varying vec2 vUv;
  void main() {
    vec2 p=(vUv-0.5)*2.0; float r=length(p);
    float rays=0.7+0.3*pow(abs(sin(atan(p.y,p.x)*9.0)),3.0);
    float glow=exp(-r*5.0)*smoothstep(1.0,0.15,r)*rays;
    gl_FragColor=vec4(uColor,glow*0.55);
  }
`;

export function DetailedStar({ star, onClick }: { star: StarData; onClick?: (event: ThreeEvent<MouseEvent>) => void }) {
  const surface = useRef<THREE.ShaderMaterial>(null);
  const radius = starRadius(star);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(star.color) }, uTime: { value: 0 } }), [star.color]);
  useFrame(({ clock }) => { if (surface.current) surface.current.uniforms.uTime.value = clock.elapsedTime; });
  return (
    <group position={star.position}>
      <Billboard>
        <mesh raycast={() => null}>
          <planeGeometry args={[radius * 7, radius * 7]} />
          <shaderMaterial
            uniforms={uniforms}
            vertexShader="varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
            fragmentShader={coronaShader}
            transparent depthWrite={false} blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>
      <mesh onClick={onClick}>
        <sphereGeometry args={[radius, 64, 48]} />
        <shaderMaterial ref={surface} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader} />
      </mesh>
    </group>
  );
}

interface Props {
  stars: StarData[]; onStarClick: (star: StarData) => void;
  selectedStarId: string | null; highlightedStarId: string | null;
  onHoverStar: (id: string | null) => void; rotationSpeed?: number; spinRef?: SpinRef;
}
export const ClickableStars = memo(function ClickableStars({ stars, onStarClick, selectedStarId, onHoverStar, spinRef, rotationSpeed = 0 }: Props) {
  const group = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Points>(null);
  const hits = useRef(new Map<string, THREE.Mesh>());
  const rings = useRef(new Map<string, THREE.Group>());
  const scratch = useRef(new THREE.Vector3());
  const positions = useMemo(() => new Float32Array(stars.flatMap(star => star.position)), [stars]);
  const markerColors = useMemo(() => new Float32Array(stars.flatMap(star => {
    const c = new THREE.Color(star.color);
    return [c.r, c.g, c.b];
  })), [stars]);
  const markerSizes = useMemo(() => new Float32Array(stars.map(star =>
    star.capital ? 9 : Math.max(4.5, Math.min(8, 7.5 - star.magnitude * 0.6)),
  )), [stars]);
  useFrame((state, delta) => {
    if (group.current) group.current.rotation.y = spinRef ? spinRef.current : group.current.rotation.y + delta * rotationSpeed;
    // Keep click targets and capital rings a constant size on screen so stars
    // stay clickable and capitals stay visible at any zoom level.
    const camera = state.camera as THREE.PerspectiveCamera;
    const pixelsToWorld = (distance: number) =>
      (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / state.size.height;
    for (const star of stars) {
      const hit = hits.current.get(star.id);
      if (hit) {
        hit.getWorldPosition(scratch.current);
        const d = state.camera.position.distanceTo(scratch.current);
        const target = 13 * pixelsToWorld(d); // ~26 px hit area
        const base = starRadius(star) * 1.1;
        hit.scale.setScalar(Math.max(1, Math.min(target / base, 5000)));
      }
      const ring = rings.current.get(star.id);
      if (ring) {
        ring.getWorldPosition(scratch.current);
        const d = state.camera.position.distanceTo(scratch.current);
        ring.scale.setScalar(Math.max(0.0005, 20 * pixelsToWorld(d)));
      }
    }
  });
  return (
    <group ref={group}>
      <points ref={marker} raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions,3]} />
          <bufferAttribute attach="attributes-color" args={[markerColors,3]} />
          <bufferAttribute attach="attributes-size" args={[markerSizes,1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexColors
          vertexShader="attribute float size; varying vec3 vColor; varying float vFade;
            void main(){
              vColor = color;
              vec4 p = modelViewMatrix * vec4(position, 1.0);
              float dist = max(0.01, -p.z);
              vFade = smoothstep(0.03, 0.25, dist); // the shader star takes over up close
              gl_PointSize = size * mix(0.4, 1.0, vFade);
              gl_Position = projectionMatrix * p;
            }"
          fragmentShader="varying vec3 vColor; varying float vFade;
            void main(){
              vec2 uv = gl_PointCoord - 0.5;
              float r = length(uv) * 2.0;
              if (r > 1.0) discard;
              float core = exp(-r * r * 14.0);
              float halo = exp(-r * r * 3.2) * 0.7;
              float d = min(abs(uv.x), abs(uv.y));
              float glint = exp(-d * d * 300.0) * exp(-r * r * 1.8) * 0.55;
              vec3 col = vColor * (halo + glint) + vec3(1.0) * core;
              gl_FragColor = vec4(col, (core + halo + glint) * vFade);
            }"
          transparent depthWrite={false} blending={THREE.AdditiveBlending}
        />
      </points>
      {stars.map(star => (
        <group key={star.id}>
          <DetailedStar star={star} onClick={event => { event.stopPropagation(); onStarClick(star); }} />
          <mesh position={star.position}
            ref={el => { if (el) hits.current.set(star.id, el); else hits.current.delete(star.id); }}
            onClick={event => { event.stopPropagation(); onStarClick(star); }}
            onPointerOver={event => { event.stopPropagation(); onHoverStar(star.id); }}
            onPointerOut={() => onHoverStar(null)}>
            <sphereGeometry args={[starRadius(star) * 1.1, 16, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {star.capital && (
            <group ref={el => { if (el) rings.current.set(star.id, el); else rings.current.delete(star.id); }}>
              <Billboard>
                <mesh raycast={() => null}>
                  <ringGeometry args={[0.75, 1, 64]} />
                  <meshBasicMaterial color="#ffd36b" transparent opacity={0.9} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
                <mesh raycast={() => null}>
                  <ringGeometry args={[1.12, 1.2, 64]} />
                  <meshBasicMaterial color="#f59e0b" transparent opacity={0.45} depthWrite={false} side={THREE.DoubleSide} />
                </mesh>
              </Billboard>
            </group>
          )}
          {selectedStarId === star.id && <mesh position={star.position} raycast={() => null}>
            <sphereGeometry args={[starRadius(star) * 1.02, 24, 16]} />
            <meshBasicMaterial color="#fcd34d" wireframe transparent opacity={0.06} />
          </mesh>}
        </group>
      ))}
    </group>
  );
});
