import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Billboard, Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import milkyWayUrl from "@/assets/milky-way-map.jpg";
import {
  pointInBounds,
  toScene,
  ATLAS_COLORS,
  computeQuadrantFrame,
  computeSectorFrame,
  computeSystemFrame,
} from "./types";
import type { AtlasSnapshot, AtlasLevel, AtlasSector, AtlasQuadrant, AtlasSystem, AtlasLane } from "./types";

// =========================================================================
// AtlasScene — all spatial rendering. Per-level visibility:
//   galaxy  → disk + quadrant volumes + real-star anchors + galaxy gates
//   quadrant→ the focused quadrant's content, framed & spread to fill view
//   sector  → the focused sector's systems, framed & spread to fill view
//   system  → the focused system enlarged with POIs/gates/lanes
//
// Everything below galaxy renders inside a <LevelGroup> that applies the
// level's frame (center + scale), so children are laid out in LOCAL space
// and the same framing math powers the camera. This is what makes drill-in
// spread the systems out instead of leaving them a clump of dots.
// =========================================================================

export type SceneFrame = {
  center: [number, number, number];
  scale: number;
};

/** Applies a level frame: content is positioned in local scene coords. */
function LevelGroup({ frame, children }: { frame: SceneFrame | null; children: React.ReactNode }) {
  if (!frame) return <>{children}</>;
  return (
    <group position={frame.center} scale={frame.scale}>
      {children}
    </group>
  );
}

function GalaxyDisk() {
  // Real Milky Way survey plate as the disk face, lit with a gentle tilt so
  // the galaxy reads as a three-dimensional object rather than a flat
  // sprite. The texture loads off the suspense path: while it streams (or
  // if it fails entirely) a procedural spiral dust field renders instead,
  // so the galaxy view is never blank.
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      milkyWayUrl,
      (t) => {
        if (cancelled) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        setTexture(t);
      },
      undefined,
      () => {
        /* load failed — the procedural fallback keeps rendering */
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Sparse far-side sparkle that catches parallax as the camera orbits.
  const positions = useMemo(() => {
    const N = 900;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = Math.pow(Math.random(), 0.75) * 1.02;
      const theta = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 0.01 * (1 + r);
      arr[i * 3] = Math.cos(theta) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(theta) * r;
    }
    return arr;
  }, []);

  // Procedural spiral dust used until (and unless) the plate is loaded.
  const spiralPositions = useMemo(() => {
    const N = 2400;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const arm = Math.floor(Math.random() * 4) * (Math.PI / 2);
      const t = Math.random();
      const r = Math.pow(t, 0.6);
      const swirl = r * 3.6 + arm + (Math.random() - 0.5) * 0.55;
      const jitter = (Math.random() - 0.5) * (0.22 + r * 0.3);
      const theta = swirl + jitter;
      const y = (Math.random() - 0.5) * 0.014 * (1 + r);
      arr[i * 3] = Math.cos(theta) * r;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = Math.sin(theta) * r;
    }
    return arr;
  }, []);

  const starGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  const spiralGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(spiralPositions, 3));
    return g;
  }, [spiralPositions]);

  return (
    <group rotation={[0.06, 0, 0.03]}>
      {texture ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 128]} />
          <meshBasicMaterial map={texture} toneMapped={false} transparent depthWrite={false} />
        </mesh>
      ) : (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1, 96]} />
            <meshBasicMaterial color={ATLAS_COLORS.disk} transparent opacity={0.92} depthWrite={false} />
          </mesh>
          <points geometry={spiralGeo}>
            <pointsMaterial
              size={0.0045}
              color="#9db8e8"
              transparent
              opacity={0.7}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              sizeAttenuation
            />
          </points>
        </>
      )}
      {/* Thin additive halo so the rim glows instead of cutting off hard. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[0.94, 1.03, 128]} />
        <meshBasicMaterial color="#35507a" transparent opacity={0.28} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <points geometry={starGeo}>
        <pointsMaterial
          size={0.005}
          color="#cfe0ff"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  );
}

function VolumeBox({
  bounds,
  color,
  opacity = 0.08,
  edgeOpacity = 0.55,
  dashed = false,
}: {
  bounds: AtlasQuadrant | AtlasSector;
  color: string;
  opacity?: number;
  edgeOpacity?: number;
  dashed?: boolean;
}) {
  const c = boundsCenterOf(bounds);
  const size: [number, number, number] = [
    (bounds.maxX - bounds.minX) / 50000,
    (bounds.maxZ - bounds.minZ) / 50000,
    (bounds.maxY - bounds.minY) / 50000,
  ];
  const edges = useMemo(() => {
    const box = new THREE.BoxGeometry(...size);
    return new THREE.EdgesGeometry(box);
  }, [size[0], size[1], size[2]]);

  return (
    <group position={toScene(c)}>
      <mesh>
        <boxGeometry args={size} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial
          color={color}
          transparent
          opacity={edgeOpacity}
          {...(dashed ? { dashed: true, dashSize: 0.03, gapSize: 0.02 } : {})}
        />
      </lineSegments>
    </group>
  );
}

function boundsCenterOf(b: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }) {
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, z: (b.minZ + b.maxZ) / 2 };
}

function QuadrantVolumes({
  snapshot,
  onPick,
  interactive = true,
  labelScale = 0.045,
}: {
  snapshot: AtlasSnapshot;
  onPick: (key: string) => void;
  interactive?: boolean;
  labelScale?: number;
}) {
  return (
    <group>
      {snapshot.quadrants.map((q) => {
        const c = boundsCenterOf(q);
        const size: [number, number, number] = [
          (q.maxX - q.minX) / 50000,
          (q.maxZ - q.minZ) / 50000,
          (q.maxY - q.minY) / 50000,
        ];
        return (
          <group key={q.key} position={toScene(c)}>
            <mesh>
              <boxGeometry args={size} />
              <meshBasicMaterial
                color={q.color}
                transparent
                opacity={interactive ? 0.055 : 0.035}
                depthWrite={false}
              />
            </mesh>
            <QuadrantEdges color={q.color} size={size} interactive={interactive} />
            {interactive ? (
              <mesh
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(q.key);
                }}
                onPointerOver={() => (document.body.style.cursor = "pointer")}
                onPointerOut={() => (document.body.style.cursor = "auto")}
              >
                <boxGeometry args={size} />
                <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
              </mesh>
            ) : null}
            <Billboard position={[0, size[1] / 2 + labelScale * 1.2, 0]}>
              <Text fontSize={labelScale} color={q.color} anchorX="center" anchorY="middle" outlineWidth={labelScale * 0.12} outlineColor="#000000">
                {q.name}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

function QuadrantEdges({
  color,
  size,
  interactive,
}: {
  color: string;
  size: [number, number, number];
  interactive: boolean;
}) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size[0], size[1], size[2]]);
  return (
    <lineSegments geometry={edges}>
      <lineBasicMaterial color={color} transparent opacity={interactive ? 0.4 : 0.18} />
    </lineSegments>
  );
}

function SectorVolumes({
  sectors,
  onPick,
  labelScale = 0.02,
  hitFloor = 0,
}: {
  sectors: AtlasSector[];
  onPick: (key: string) => void;
  labelScale?: number;
  /** Screen-relative minimum hit-box half-size in LOCAL units (~0.14/scale). */
  hitFloor?: number;
}) {
  return (
    <group>
      {sectors.map((s) => {
        const c = boundsCenterOf(s);
        const proposed = s.status === "proposed";
        // Click target: the sector volume PLUS a screen-relative floor, so
        // tiny sectors are still easy to hit without swallowing the view.
        const hitSize: [number, number, number] = [
          Math.max((s.maxX - s.minX) / 50000, hitFloor),
          Math.max((s.maxZ - s.minZ) / 50000, hitFloor),
          Math.max((s.maxY - s.minY) / 50000, hitFloor),
        ];
        return (
          <group key={s.key} position={toScene(c)}>
            <VolumeBox bounds={s} color={s.color} opacity={0.09} edgeOpacity={0.7} dashed={proposed} />
            <mesh
              onClick={(e) => {
                e.stopPropagation();
                onPick(s.key);
              }}
              onPointerOver={() => (document.body.style.cursor = "pointer")}
              onPointerOut={() => (document.body.style.cursor = "auto")}
            >
              <boxGeometry args={hitSize} />
              <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
            </mesh>
            <Billboard position={[0, hitSize[1] / 2 + labelScale, 0]}>
              <Text
                fontSize={labelScale}
                color={proposed ? ATLAS_COLORS.proposed : s.color}
                anchorX="center"
                anchorY="middle"
                outlineWidth={labelScale * 0.12}
                outlineColor="#000000"
              >
                {s.name}
              </Text>
            </Billboard>
          </group>
        );
      })}
    </group>
  );
}

function StarSystem({
  system,
  highlight,
  scale,
  showLabel,
  labelScale,
  hitMin = 0,
  onPick,
  onHover,
}: {
  system: AtlasSystem;
  highlight: boolean;
  scale: number;
  showLabel: boolean;
  labelScale?: number;
  /** Screen-relative hit floor in LOCAL units (callers pass ~0.16/frameScale). */
  hitMin?: number;
  onPick: (key: string) => void;
  onHover: (key: string | null) => void;
}) {
  const color = system.isRealStar
    ? ATLAS_COLORS.star
    : system.status === "proposed"
      ? ATLAS_COLORS.proposed
      : ATLAS_COLORS.canon;
  // Hit target: at least 3× the visible dot, with an optional screen-relative
  // floor so small dots stay clickable at deep zooms (the floor shrinks as
  // the frame scale grows — a constant local floor would swallow the view).
  const hit = Math.max(scale * 3, hitMin);
  const ls = labelScale ?? scale * 12;
  return (
    <group position={toScene(system)}>
      {/* Visible dot */}
      <mesh>
        <sphereGeometry args={[scale, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Invisible generous click/hover target */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onPick(system.key);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(system.key);
        }}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[hit, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* glow sprite */}
      <sprite scale={[scale * 9, scale * 9, 1]}>
        <spriteMaterial
          color={color}
          transparent
          opacity={highlight ? 0.75 : 0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
      {showLabel ? (
        <Billboard position={[0, scale * 6 + ls * 0.6, 0]}>
          <Text
            fontSize={ls}
            color={highlight ? "#ffffff" : "#cfe9ff"}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={ls * 0.12}
            outlineColor="#000"
          >
            {system.name}
          </Text>
        </Billboard>
      ) : null}
      {highlight ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[scale * 5.5, scale * 6.2, 48]} />
          <meshBasicMaterial color={ATLAS_COLORS.gate} transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  );
}

function PulsingGate({
  gate,
  geometry,
  onPick,
}: {
  gate: { key: string; label?: string; x: number; y: number; z: number; level?: string };
  geometry: THREE.BufferGeometry;
  onPick: (key: string) => void;
}) {
  const meshRef = useMemo(() => ({ ref: null as THREE.Mesh | null }), []);
  void meshRef;
  const phase = useRef(Math.random() * Math.PI * 2);
  useFrame((_, delta) => {
    phase.current += delta * 2.4;
    if (meshRef.ref) meshRef.ref.scale.setScalar(1 + Math.sin(phase.current) * 0.25);
  });

  return (
    <group position={toScene(gate)}>
      <mesh
        ref={(m) => {
          meshRef.ref = m;
        }}
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation();
          onPick(gate.key);
        }}
      >
        <meshBasicMaterial color={ATLAS_COLORS.gate} transparent opacity={0.9} />
      </mesh>
      <sprite scale={[0.03, 0.03, 1]}>
        <spriteMaterial color={ATLAS_COLORS.gate} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      {gate.label ? (
        <Billboard>
          <Text fontSize={0.012} color="#ffb3ff" anchorX="center" anchorY="top" outlineWidth={0.001} outlineColor="#000">
            {gate.label}
          </Text>
        </Billboard>
      ) : null}
    </group>
  );
}

function WarpGates({
  gates,
  octaScale = 0.008,
  labelSize = 0.012,
  onPick,
}: {
  gates: { key: string; label?: string; x: number; y: number; z: number; level?: string }[];
  octaScale?: number;
  labelSize?: number;
  onPick: (key: string) => void;
}) {
  const octa = useMemo(() => new THREE.OctahedronGeometry(octaScale), [octaScale]);
  return (
    <group>
      {gates.map((g) => (
        <PulsingGate key={g.key} gate={g} geometry={octa} onPick={onPick} />
      ))}
    </group>
  );
}

/** Draws lanes between the systems visible at this level (all in LOCAL coords). */
function TransitLanes({
  lanes,
  systemsById,
  visibleIds,
  level,
  focusKey,
}: {
  lanes: AtlasLane[];
  systemsById: Map<string, AtlasSystem>;
  visibleIds: Set<string>;
  level: AtlasLevel;
  focusKey: string | null;
}) {
  const visible = useMemo(() => {
    return lanes.filter((l) => {
      // Both endpoints must be part of THIS level's content, otherwise the
      // line stretches to a point outside the framed view.
      if (!visibleIds.has(l.fromKey) || !visibleIds.has(l.toKey)) return false;
      if (level === "system") return l.fromKey === focusKey || l.toKey === focusKey;
      return true;
    });
  }, [lanes, visibleIds, level, focusKey]);

  return (
    <group>
      {visible.map((l) => {
        const from = systemsById.get(l.fromKey);
        const to = systemsById.get(l.toKey);
        if (!from || !to) return null;
        return (
          <Line
            key={l.key}
            points={[toScene(from), toScene(to)]}
            color={l.risk === "Forbidden" ? "#ff4444" : l.type === "hazard" ? "#ff8844" : ATLAS_COLORS.lane}
            lineWidth={l.type === "warp" ? 1.6 : 1}
            transparent
            opacity={0.55}
            dashed={l.type === "jump"}
            dashScale={40}
          />
        );
      })}
    </group>
  );
}

export default function AtlasScene({
  snapshot,
  level,
  quadrantKey,
  sectorKey,
  systemKey,
  onQuadrantPick,
  onSectorPick,
  onSystemPick,
  onGatePick,
  onHoverSystem,
}: {
  snapshot: AtlasSnapshot;
  level: AtlasLevel;
  quadrantKey: string | null;
  sectorKey: string | null;
  systemKey: string | null;
  onQuadrantPick: (key: string) => void;
  onSectorPick: (key: string) => void;
  onSystemPick: (key: string) => void;
  onGatePick: (key: string) => void;
  onHoverSystem: (info: { key: string; name: string } | null) => void;
}) {
  const systemsById = useMemo(() => new Map(snapshot.systems.map((s) => [s.key, s])), [snapshot.systems]);

  const focusQuadrant = level === "quadrant" ? snapshot.quadrants.find((q) => q.key === quadrantKey) : undefined;
  const focusSector = level === "sector" ? snapshot.sectors.find((s) => s.key === sectorKey) : undefined;
  const focusSystem = level === "system" ? snapshot.systems.find((s) => s.key === systemKey) : undefined;

  // ---- Level frames (the same math the camera rig uses to frame) ----------
  const quadrantFrame = useMemo(() => {
    if (level !== "quadrant" || !focusQuadrant) return null;
    return computeQuadrantFrame(focusQuadrant, snapshot.systems);
  }, [level, focusQuadrant, snapshot.systems]);

  const sectorFrame = useMemo(() => {
    if (level !== "sector" || !focusSector) return null;
    return computeSectorFrame(focusSector, snapshot.systems);
  }, [level, focusSector, snapshot.systems]);

  const systemFrame = useMemo(() => {
    if (level !== "system" || !focusSystem) return null;
    return computeSystemFrame(focusSystem, snapshot.systems);
  }, [level, focusSystem, snapshot.systems]);

  const activeFrame: SceneFrame | null =
    level === "quadrant" ? quadrantFrame : level === "sector" ? sectorFrame : level === "system" ? systemFrame : null;

  // ---- Per-level content, positioned in the level's LOCAL frame -----------
  const levelSystems = useMemo(() => {
    if (level === "galaxy") {
      return snapshot.systems.filter((s) => s.isRealStar && !s.sectorKey);
    }
    if (level === "quadrant" && focusQuadrant) {
      return snapshot.systems.filter((s) => pointInBounds(s, focusQuadrant));
    }
    if (level === "sector" && focusSector) {
      return snapshot.systems.filter((s) => s.sectorKey === focusSector.key || pointInBounds(s, focusSector));
    }
    if (level === "system" && focusSystem) {
      return snapshot.systems.filter((s) => s.key === focusSystem.key);
    }
    return [];
  }, [snapshot.systems, level, focusQuadrant, focusSector, focusSystem]);

  const levelGates = useMemo(() => {
    if (level === "galaxy") return snapshot.gates.filter((g) => g.level === "galaxy");
    if (level === "quadrant") {
      return snapshot.gates.filter((g) => g.level === "quadrant" || (g.level === "sector" && g.quadrantKey === quadrantKey));
    }
    if (level === "sector") {
      return snapshot.gates.filter((g) => g.sectorKey === sectorKey || (g.level === "quadrant" && false));
    }
    return [];
  }, [snapshot.gates, level, quadrantKey, sectorKey]);

  const levelLanes = useMemo(() => {
    if (level === "galaxy") return [];
    return snapshot.lanes;
  }, [snapshot.lanes, level]);

  const visibleIds = useMemo(() => new Set(levelSystems.map((s) => s.key)), [levelSystems]);

  const levelSectors = useMemo(() => {
    if (level !== "quadrant" || !quadrantKey) return [];
    return snapshot.sectors.filter((s) => s.quadrantKey === quadrantKey);
  }, [snapshot.sectors, level, quadrantKey]);

  // Screen-constant sizing: dots/labels/gates render inside the scaled
  // LevelGroup, so their local sizes divide by the frame scale to stay a
  // constant size on screen at every zoom level. The same applies to hit
  // floors: 0.14 local units × scale ≈ a constant on-screen target.
  const dotScale = 0.007 / (activeFrame?.scale ?? 1);
  // Labels: ~1.5× the dot on screen — small enough to not crowd the map,
  // still legible at every zoom level.
  const labelScale = 0.0105 / (activeFrame?.scale ?? 1);
  const gateScale = 0.009 / (activeFrame?.scale ?? 1);
  const hitFloor = 0.14 / (activeFrame?.scale ?? 1);

  return (
    <group>
      {level === "galaxy" ? <GalaxyDisk /> : null}

      {/* Quadrant volumes ALWAYS overlay the galaxy — they split it into
          four pieces; only their interactivity switches with the level. */}
      <QuadrantVolumes
        snapshot={snapshot}
        onPick={level === "galaxy" ? onQuadrantPick : () => undefined}
        labelScale={level === "galaxy" ? 0.03 : undefined}
        interactive={level === "galaxy"}
      />

      {level === "quadrant" ? (
        <LevelGroup frame={activeFrame}>
          {focusQuadrant ? (
            <VolumeBox bounds={focusQuadrant} color={focusQuadrant.color} opacity={0.05} edgeOpacity={0.65} />
          ) : null}
          <SectorVolumes sectors={levelSectors} onPick={onSectorPick} labelScale={labelScale} hitFloor={hitFloor} />
          {levelSystems.map((s) => (
            <StarSystem
              key={s.key}
              system={s}
              highlight={s.key === systemKey}
              scale={dotScale}
              showLabel={levelSystems.length <= 40 || s.key === systemKey}
              labelScale={labelScale * 1.2}
              hitMin={hitFloor}
              onPick={(key) => onSystemPick(key)}
              onHover={(key) => onHoverSystem(key ? { key, name: systemsById.get(key)?.name ?? "" } : null)}
            />
          ))}
          <WarpGates gates={levelGates} octaScale={gateScale} onPick={onGatePick} />
        </LevelGroup>
      ) : null}

      {level === "sector" ? (
        <LevelGroup frame={activeFrame}>
          {focusSector ? (
            <VolumeBox bounds={focusSector} color={focusSector.color} opacity={0.07} edgeOpacity={0.8} />
          ) : null}
          {levelSystems.map((s) => (
            <StarSystem
              key={s.key}
              system={s}
              highlight={s.key === systemKey}
              scale={dotScale}
              showLabel
              labelScale={labelScale * 1.2}
              hitMin={hitFloor}
              onPick={(key) => onSystemPick(key)}
              onHover={(key) => onHoverSystem(key ? { key, name: systemsById.get(key)?.name ?? "" } : null)}
            />
          ))}
          <WarpGates gates={levelGates} octaScale={gateScale} onPick={onGatePick} />
        </LevelGroup>
      ) : null}

      {level === "system" ? (
        <LevelGroup frame={activeFrame}>
          {levelSystems.map((s) => (
            <StarSystem
              key={s.key}
              system={s}
              highlight={s.key === systemKey}
              scale={dotScale * 1.8}
              showLabel
              labelScale={labelScale * 1.4}
              hitMin={hitFloor}
              onPick={() => undefined}
              onHover={() => undefined}
            />
          ))}
        </LevelGroup>
      ) : null}

      {/* Galaxy-level real-star anchors + labels (outside LevelGroups). */}
      {level === "galaxy" ? (
        <group>
          {snapshot.systems
            .filter((s) => s.isRealStar && !s.sectorKey)
            .map((s) => (
              <StarSystem
                key={s.key}
                system={s}
                highlight={s.key === "sol"}
                scale={0.007}
                showLabel
                labelScale={0.011}
                onPick={(key) => onSystemPick(key)}
                onHover={(key) => onHoverSystem(key ? { key, name: systemsById.get(key)?.name ?? "" } : null)}
              />
            ))}
          <WarpGates
            gates={snapshot.gates.filter((g) => g.level === "galaxy")}
            octaScale={0.009}
            onPick={onGatePick}
          />
        </group>
      ) : null}

      <TransitLanes
        lanes={levelLanes}
        systemsById={systemsById}
        visibleIds={visibleIds}
        level={level}
        focusKey={systemKey}
      />
    </group>
  );
}
