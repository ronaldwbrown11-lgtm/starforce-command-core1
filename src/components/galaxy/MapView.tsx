import { useEffect, useMemo, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import type {
  PlacedQuadrant,
  PlacedSector,
  PlacedStarSystem,
} from "./mapGeometry";
import { wedgeOutline } from "./mapGeometry";
import { clickToGalaxyLocal, PLACE_DRAG_THRESHOLD } from "./placement";
import type { SpinRef } from "./rotation";
import { DetailedStar } from "./ClickableStars";
import type { StarData } from "./galaxyData";

/** Synthetic star for an atlas system — systems look like real stars up
 *  close, matching the praised 47 Ursa Majoris close-up. */
function systemStar(sys: PlacedStarSystem): StarData {
  return {
    id: `mapsys-${sys.id}`,
    name: sys.name,
    defaultName: sys.name,
    position: [0, 0, 0],
    color: sys.color,
    size: 1.5,
    temperature: 5800,
    magnitude: 1,
  };
}

/** Radius of the synthetic system star (size 1.5 → clamped 0.018). */
export const SYSTEM_STAR_RADIUS = 0.018;

// ---------------------------------------------------------------------------
// MapView — the galactic atlas overlay drawn in-scene:
//  • galaxy view:    quadrant wedges + clickable quadrant labels
//  • quadrant view:  sectors labeled + star systems
//  • sector view:    zoomed systems with labels, siblings dimmed
//  • sectors and star systems can be dragged to new map positions
// ---------------------------------------------------------------------------

export type MapFocus =
  | { level: "galaxy" }
  | { level: "quadrant"; quadrantId: string }
  | { level: "sector"; sectorId: string };

export type DraggableEntity = "sector" | "system";

export interface EntityDragOverride {
  kind: DraggableEntity;
  id: string;
  pos: [number, number, number];
}

interface MapViewProps {
  focus: MapFocus;
  quadrants: PlacedQuadrant[];
  sectors: PlacedSector[];
  systems: PlacedStarSystem[];
  onFocusQuadrant: (id: string) => void;
  onFocusSector: (id: string) => void;
  onSelectSystem: (system: PlacedStarSystem) => void;
  selectedSystemId: string | null;
  /** Lore-list stars — used to detect systems sitting on a real star. */
  stars: StarData[];
  /** Shared galaxy spin angle — drags must undo the current rotation. */
  spinRef?: SpinRef;
  /** Entity dragging is disabled while click-to-place mode is active. */
  dragEnabled?: boolean;
  /** Layer visibility for the map filters (galaxy + sector maps): hide the
   *  sector outlines/labels or the system markers. Quadrant wedges and the
   *  warp-gate nodes (hubs/gates) are drawn outside MapView. */
  layers?: { sectors: boolean; systems: boolean };
  /** true while an entity drag gesture is in progress. */
  onDragStateChange?: (dragging: boolean) => void;
  /** Live position of the entity under the cursor during a drag. */
  onDragEntity?: (override: EntityDragOverride | null) => void;
  /** Drag finished: drop the entity at `pos` (null = no move happened). */
  onMoveEntity?: (
    kind: DraggableEntity,
    id: string,
    pos: [number, number, number] | null,
  ) => void;
}

export function MapView({
  focus,
  quadrants,
  sectors,
  systems,
  onFocusQuadrant,
  onFocusSector,
  onSelectSystem,
  selectedSystemId,
  stars,
  spinRef,
  dragEnabled = true,
  layers = { sectors: true, systems: true },
  onDragStateChange,
  onDragEntity,
  onMoveEntity,
}: MapViewProps) {
  // Which slice of the hierarchy is visible right now
  const visibleSectors = useMemo(() => {
    if (focus.level === "galaxy") return [];
    if (focus.level === "quadrant") {
      return sectors.filter((s) => s.quadrantId === focus.quadrantId);
    }
    return sectors.filter((s) => s.id === focus.sectorId);
  }, [focus, sectors]);

  const visibleSystems = useMemo(() => {
    if (focus.level === "galaxy") return [];
    const sectorIds = new Set(visibleSectors.map((s) => s.id));
    return systems.filter((s) => sectorIds.has(s.sectorId));
  }, [focus, visibleSectors, systems]);

  const dimmed = focus.level === "sector";

  // Layer filters: the toggles hide the sector and system layers wholesale.
  const shownBounds = layers.sectors
    ? focus.level === "galaxy"
      ? sectors
      : visibleSectors
    : [];
  const shownSectors = layers.sectors ? visibleSectors : [];
  const shownSystems = layers.systems ? visibleSystems : [];

  // Systems that sit on a real star leave the star its own close-up render.
  const starBacked = useMemo(() => {
    const set = new Set<string>();
    for (const sys of systems) {
      for (const star of stars) {
        const dx = star.position[0] - sys.position[0];
        const dy = star.position[1] - sys.position[1];
        const dz = star.position[2] - sys.position[2];
        if (dx * dx + dy * dy + dz * dz < 0.03 * 0.03) {
          set.add(sys.id);
          break;
        }
      }
    }
    return set;
  }, [systems, stars]);

  // ---- Entity dragging -----------------------------------------------------
  // A drag starts on a sector label or a star system marker/label; the pointer
  // is then tracked on the window so the entity follows the cursor even when
  // it leaves the marker. Movements under the threshold count as clicks.
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const dragRef = useRef<{
    kind: DraggableEntity;
    id: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const dragPosRef = useRef<[number, number, number] | null>(null);
  const suppressClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const beginDrag = (
    kind: DraggableEntity,
    id: string,
    e: { clientX: number; clientY: number },
  ) => {
    if (!dragEnabled) return;
    suppressClickRef.current = false; // stale suppression must not eat clicks
    dragRef.current = {
      kind,
      id,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    dragPosRef.current = null;
    setDragging(true);
    onDragStateChange?.(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const localAt = (e: { clientX: number; clientY: number }) =>
      clickToGalaxyLocal(
        camera,
        gl.domElement.getBoundingClientRect(),
        e.clientX,
        e.clientY,
        spinRef?.current ?? 0,
      );
    const onMove = (e: PointerEvent) => {
      const session = dragRef.current;
      if (!session) return;
      if (
        !session.moved &&
        Math.hypot(e.clientX - session.startX, e.clientY - session.startY) <=
          PLACE_DRAG_THRESHOLD
      )
        return;
      session.moved = true;
      const local = localAt(e);
      if (local) {
        dragPosRef.current = local;
        onDragEntity?.({ kind: session.kind, id: session.id, pos: local });
      }
    };
    const finish = (commit: boolean) => (e: PointerEvent) => {
      const session = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      onDragStateChange?.(false);
      if (!session) return;
      if (session.moved) {
        suppressClickRef.current = true;
        const local = commit ? localAt(e) : null;
        onMoveEntity?.(session.kind, session.id, local ?? dragPosRef.current);
      } else {
        onMoveEntity?.(session.kind, session.id, null);
      }
      dragPosRef.current = null;
    };
    const onUp = finish(true);
    const onCancel = finish(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [dragging, camera, gl, spinRef, onDragEntity, onMoveEntity, onDragStateChange]);

  // A click immediately after a drag belongs to the drag, not to selection.
  const clickThrough = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return true;
    }
    return false;
  };

  return (
    <group>
      {/* ---- Quadrant wedges ---- */}
      {quadrants.map((quad) => {
        const isFocused =
          focus.level === "quadrant" && focus.quadrantId === quad.id;
        const inSector =
          focus.level === "sector" &&
          sectors.some(
            (s) => s.id === focus.sectorId && s.quadrantId === quad.id,
          );
        const active = isFocused || inSector;
        const opacity = active ? 0.95 : dimmed ? 0.4 : 0.75;
        const points = wedgeOutline(quad.wedge);
        return (
          <group key={quad.id}>
            <Line
              points={points}
              color={quad.color}
              lineWidth={active ? 4 : 2.5}
              depthTest={false}
              transparent
              opacity={opacity}
              depthWrite={false}
            />
            {/* Clickable quadrant label at wedge mid-point */}
            <Html
              position={quad.center}
              center
              distanceFactor={26}
              style={{ pointerEvents: "auto" }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFocusQuadrant(quad.id);
                }}
                className="group flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap cursor-pointer transition-all duration-200 border backdrop-blur-sm"
                style={{
                  backgroundColor: active
                    ? `${quad.color}30`
                    : "rgba(0,0,0,0.55)",
                  borderColor: active ? quad.color : `${quad.color}44`,
                  opacity: dimmed && !active ? 0.35 : 1,
                }}
                title={`Zoom to ${quad.name}`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: quad.color }}
                />
                <span
                  className="text-[11px] font-semibold tracking-wide"
                  style={{ color: quad.color }}
                >
                  {quad.name}
                </span>
              </button>
            </Html>
          </group>
        );
      })}

      {/* ---- Sector boundaries: a faint grid tiling the whole disk at galaxy
           level, full-strength wedge outlines once a quadrant is focused — so
           sector bounds visibly cover the entire galaxy. ---- */}
      {shownBounds.map((sector) => {
        const grid = focus.level === "galaxy";
        const active =
          focus.level === "sector" && focus.sectorId === sector.id;
        return (
          <Line
            key={`bounds-${sector.id}`}
            points={wedgeOutline(
              sector.wedge,
              grid ? 16 : 24,
              sector.inner,
              sector.outer,
            )}
            color={sector.color}
            lineWidth={grid ? 1 : active ? 3 : 2}
            depthTest={false}
            transparent
            opacity={
              grid ? 0.25 : dimmed && !active ? 0.4 : active ? 0.95 : 0.7
            }
            depthWrite={false}
          />
        );
      })}

      {/* ---- Draggable sector labels (only past galaxy view) ---- */}
      {shownSectors.map((sector) => {
        const isFocused =
          focus.level === "sector" && focus.sectorId === sector.id;
        return (            <Html
            key={sector.id}
            position={sector.center}
            center
            style={{ pointerEvents: "auto" }}
          >
            <button
              onPointerDown={(e) => beginDrag("sector", sector.id, e)}
              onClick={(e) => {
                e.stopPropagation();
                if (clickThrough()) return;
                onFocusSector(sector.id);
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md whitespace-nowrap cursor-grab active:cursor-grabbing transition-all duration-200 border backdrop-blur-sm"
              style={{
                backgroundColor: isFocused
                  ? `${sector.color}35`
                  : "rgba(0,0,0,0.5)",
                borderColor: isFocused ? sector.color : `${sector.color}40`,
              }}
              title={`Drag to move ${sector.name} · click to zoom`}
            >
              <span
                className="text-[9px] font-medium"
                style={{ color: sector.color }}
              >
                ▸ {sector.name}
              </span>
            </button>
          </Html>
        );
      })}

      {/* ---- Star system markers (draggable) ---- */}
      {shownSystems.map((sys) => {
        // Systems sitting on a real star leave the close-up to the star itself.
        if (starBacked.has(sys.id)) return null;
        const selected = sys.id === selectedSystemId;
        // Label anchored a couple of stellar radii out on the diagonal, like
        // the praised 47 Ursa Majoris close-up — it never covers the star.
        const label: [number, number, number] = [
          SYSTEM_STAR_RADIUS * 2,
          SYSTEM_STAR_RADIUS * 2,
          0,
        ];
        return (
          <group key={sys.id} position={sys.position}>
            {/* Shader surface + corona — the 47 Ursa Majoris close-up look. */}
            <DetailedStar star={systemStar(sys)} />
            {/* glow halo */}
            <mesh raycast={() => null}>
              <sphereGeometry args={[selected ? 0.09 : 0.06, 32, 24]} />
              <meshBasicMaterial
                color={sys.color}
                transparent
                opacity={0.18}
                depthWrite={false}
              />
            </mesh>
            {/* invisible hit target for click + drag */}
            <mesh
              onPointerDown={(e) => {
                e.stopPropagation();
                beginDrag("system", sys.id, e);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (clickThrough()) return;
                onSelectSystem(sys);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "default";
              }}
            >
              <sphereGeometry args={[0.06, 16, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <Line
              points={[[0, 0, 0], label]}
              color={sys.color}
              transparent
              opacity={0.5}
              lineWidth={0.7}
            />
            <Html
              position={label}
              zIndexRange={[10, 0]}
              style={{ pointerEvents: "auto" }}
            >
              <button
                onPointerDown={(e) => beginDrag("system", sys.id, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (clickThrough()) return;
                  onSelectSystem(sys);
                }}
                className={`whitespace-nowrap rounded border bg-slate-950/85 px-1.5 py-0.5 font-mono text-[9px] cursor-grab active:cursor-grabbing backdrop-blur-sm${selected ? " font-semibold" : ""}`}
                style={{
                  color: sys.color,
                  borderColor: selected ? sys.color : `${sys.color}55`,
                  backgroundColor: selected
                    ? `${sys.color}35`
                    : "rgba(0,0,0,0.8)",
                }}
                title={`Drag to move ${sys.name} · click to edit`}
              >
                {sys.name}
              </button>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
