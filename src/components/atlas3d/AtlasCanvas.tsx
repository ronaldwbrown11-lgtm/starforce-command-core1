import { Canvas } from "@react-three/fiber";
import AtlasScene from "./AtlasScene";
import { CameraRig } from "./CameraRig";
import {
  computeQuadrantFrame,
  computeSectorFrame,
  computeSystemFrame,
  type AtlasFrame,
} from "./types";
import type { AtlasLevel, AtlasSnapshot } from "./types";

// =========================================================================
// AtlasCanvas — the R3F renderer. Pure view: data + navigation state in,
// interactive 3D out. HUD lives outside the canvas as DOM overlay. The
// camera rig frames the level's LOCAL content frame (same math AtlasScene
// uses to lay content out), so the camera and scene always agree.
// =========================================================================

function frameFor(
  level: AtlasLevel,
  snapshot: AtlasSnapshot,
  quadrantKey: string | null,
  sectorKey: string | null,
  systemKey: string | null,
): AtlasFrame {
  if (level === "galaxy") return { center: [0, 0, 0], scale: 1, distance: 2.6 };
  const q = level === "quadrant" ? snapshot.quadrants.find((x) => x.key === quadrantKey) : undefined;
  if (q) return computeQuadrantFrame(q, snapshot.systems);
  const s = level === "sector" ? snapshot.sectors.find((x) => x.key === sectorKey) : undefined;
  if (s) return computeSectorFrame(s, snapshot.systems);
  const sys = level === "system" ? snapshot.systems.find((x) => x.key === systemKey) : undefined;
  if (sys) return computeSystemFrame(sys);
  return { center: [0, 0, 0], scale: 1, distance: 2.6 };
}

export default function AtlasCanvas({
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
  const frame = frameFor(level, snapshot, quadrantKey, sectorKey, systemKey);

  return (
    <Canvas
      camera={{ position: [0, 1.6, 2.6], fov: 55, near: 0.001, far: 100 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor("#050510");
      }}
    >
      <CameraRig frame={frame} />
      <ambientLight intensity={1} />
      <AtlasScene
        snapshot={snapshot}
        level={level}
        quadrantKey={quadrantKey}
        sectorKey={sectorKey}
        systemKey={systemKey}
        onQuadrantPick={onQuadrantPick}
        onSectorPick={onSectorPick}
        onSystemPick={onSystemPick}
        onGatePick={onGatePick}
        onHoverSystem={onHoverSystem}
      />
    </Canvas>
  );
}
