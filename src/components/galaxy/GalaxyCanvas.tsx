import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard, OrbitControls } from "@react-three/drei";
import { MilkyWay } from "./MilkyWay";
import { ClickableStars } from "./ClickableStars";
import { starRadius, seededNoise, getGalaxyData } from "./galaxyData";
import { REAL_STARS } from "./realStars";
import { WarpLaneEditor, type SavedWarpLane, type WarpCrud, type LaneDraft } from "./WarpLaneEditor";
import { Html, Line } from "@react-three/drei";
import { Crosshair, Keyboard } from "lucide-react";
import { StarLabels } from "./StarLabels";
import type { StarData, StarCategory } from "./galaxyData";
import { StarDialog } from "./StarDialog";
import { LoreSidebar } from "./LoreSidebar";
import { CameraRig, ZOOM_MIN, ZOOM_MAX, type CameraApi } from "./CameraRig";
import { RotationDriver, RotGroup, spinPoint, type SpinRef } from "./rotation";
import {
  clickToGalaxyLocal,
  pickGalaxyDot,
  findNeighborDot,
  snapWarpEndpoint,
  PLACE_DRAG_THRESHOLD,
  type GalaxyDot,
} from "./placement";
import {
  MapView,
  SYSTEM_STAR_RADIUS,
  type MapFocus,
  type DraggableEntity,
  type EntityDragOverride,
} from "./MapView";
import { MapOverlay } from "./MapOverlay";
import { ArmLabels } from "./ArmLabels";
import { MapEditor } from "./MapEditor";
import { MapEntityDialog } from "./MapEntityDialog";
import type { MapEntityDraft, MapEntityKind } from "./MapEntityDialog";
import {
  laneColor,
  placeQuadrants,
  placeSectors,
  placeSystems,
  type MapQuadrant,
  type MapSector,
  type MapStarSystem,
  type PlacedStarSystem,
  type WarpGateLevel,
  type WarpGateNode,
} from "./mapGeometry";

// Shared zoom bounds (CameraRig clamps dollies to this range)


// Fly-to distances per navigation level
const DIST_GALAXY = 46;
const DIST_QUADRANT = 34;
const DIST_SECTOR = 15;
const DIST_STAR = 0.002;

/** On-canvas control legend (top-center). Mirrors CameraRig + OrbitControls:
 *  the arrow/WASD keys and Shift+scroll/middle-drag slide the map, +− and
 *  the wheel zoom it, left-drag orbits. */
const CONTROL_HINTS: { keys: string[]; label: string }[] = [
  { keys: ["↑", "↓", "←", "→"], label: "slide" },
  { keys: ["W", "A", "S", "D"], label: "slide" },
  { keys: ["+", "−"], label: "zoom" },
  { keys: ["Shift", "scroll"], label: "slide" },
  { keys: ["middle-drag"], label: "slide" },
  { keys: ["left-drag"], label: "orbit" },
];

/** Camera + canvas size handed over by PickBridge for DOM-side star picking. */
interface PickScene {
  camera: THREE.Camera;
  width: number;
  height: number;
}

export interface MapEntityCrud {
  create: (
    kind: MapEntityKind,
    parentId: string | null,
    draft: MapEntityDraft,
  ) => Promise<void> | void;
  update: (
    kind: MapEntityKind,
    id: string,
    draft: MapEntityDraft,
  ) => Promise<void> | void;
  remove: (kind: MapEntityKind, id: string) => Promise<void> | void;
}

interface GalaxyCanvasProps {
  prominentStars: StarData[];
  starNames: Record<string, string>;
  onSetStarName: (
    starId: string,
    name: string,
    star: StarData,
    category: StarCategory,
    notes: string,
  ) => Promise<void>;
  onResetStarName: (starId: string) => Promise<void>;
  loreNotes: Record<string, string>;
  warpLanes: SavedWarpLane[];
  warpCrud: WarpCrud;
  starCategories: Record<string, StarCategory>;
  // Galactic atlas
  mapQuadrants: MapQuadrant[];
  mapSectors: MapSector[];
  mapSystems: MapStarSystem[];
  warpGates: WarpGateNode[];
  mapCrud: MapEntityCrud;
  compact?: boolean;
  /** View-only mode — creation tools, editors and save paths hidden. */
  readOnly?: boolean;
  /** Member lore pin placement uses the same native 3D galaxy click plane. */
  builderPlacementMode?: boolean;
  onBuilderPlace?: (position: [number, number, number], sectorId: string) => void;
  onCancelBuilderPlacement?: () => void;
}

export function GalaxyCanvas({
  prominentStars,
  starNames,
  onSetStarName,
  onResetStarName,
  loreNotes,
  warpLanes,
  warpCrud,
  starCategories,
  mapQuadrants,
  mapSectors,
  mapSystems,
  warpGates,
  mapCrud,
  compact = false,
  readOnly = false,
  builderPlacementMode = false,
  onBuilderPlace,
  onCancelBuilderPlacement,
}: GalaxyCanvasProps) {
  const [selectedStar, setSelectedStar] = useState<StarData | null>(null);
  const [highlightedStar, setHighlightedStar] = useState<StarData | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const stars = useMemo(() => {
    const catalog = new Map(REAL_STARS.map(star => [star.id, star]));
    prominentStars.forEach(star => catalog.set(star.id, star));
    return [...catalog.values()];
  }, [prominentStars]);
  const [newStar, setNewStar] = useState(false);
  // Background star dot under the cursor (for the hover highlight).
  const [hoverDot, setHoverDot] = useState<GalaxyDot | null>(null);
  // Dot selected by arrow-key navigation — overrides the hover highlight and
  // is the target of click/Enter until the pointer moves again.
  const [keyDot, setKeyDot] = useState<GalaxyDot | null>(null);
  const [showLanes, setShowLanes] = useState(false);
  const [laneEditId, setLaneEditId] = useState<string | undefined>();
  // Warp-gate endpoint picking: the editor snapshots its draft, closes, and a
  // map click snaps to the nearest endpoint (seeded sector stars preferred).
  const [lanePick, setLanePick] = useState<
    { which: "from" | "to"; draft: LaneDraft } | null
  >(null);
  const [laneDraft, setLaneDraft] = useState<LaneDraft | null>(null);
  // Click-to-place: when active, clicking the galactic map creates a star,
  // sector, or warp gate node at that exact spot.
  const [placeKind, setPlaceKind] = useState<"star" | "sector" | "gate" | null>(null);
  // Pending sector creation at a clicked map position.
  const [createSectorAt, setCreateSectorAt] = useState<{
    parentId: string;
    parentLabel: string;
    position: [number, number, number];
  } | null>(null);
  // Pending warp-gate creation at a clicked map position.
  const [createGateAt, setCreateGateAt] = useState<{
    level: WarpGateLevel;
    parentId: string;
    parentLabel: string;
    defaultName: string;
    defaultColor: string;
    position: [number, number, number];
  } | null>(null);
  // Why the last gate placement was refused (e.g. quadrant already has its
  // hub) — shown in the placement banner until the next attempt.
  const [gateError, setGateError] = useState<string | null>(null);
  // Map-layer filters: quadrant hubs, sectors, systems, warp gate nodes.
  const [layers, setLayers] = useState({
    hubs: true,
    sectors: true,
    systems: true,
    gates: true,
  });
  const [showLayers, setShowLayers] = useState(false);
  // Collapsible on-canvas control legend (top-center strip).
  const [showControls, setShowControls] = useState(true);
  // Live position of a sector / star system being dragged on the map.
  const [entityDrag, setEntityDrag] = useState<EntityDragOverride | null>(null);
  const [entityDragging, setEntityDragging] = useState(false);

  // Atlas state
  const [focus, setFocus] = useState<MapFocus>({ level: "galaxy" });
  const [showMapEditor, setShowMapEditor] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [mapDialog, setMapDialog] = useState<{
    kind: MapEntityKind;
    id: string;
  } | null>(null);

  // Rotation starts still; the toggle turns the galaxy's spin on/off.
  const [rotating, setRotating] = useState(false);

  // Shared galaxy angle — every rotating component reads this so labels,
  // stars, and the atlas map can never drift apart.
  const spinRef = useRef(0);
  const cameraApiRef = useRef<CameraApi | null>(null);
  const pickSceneRef = useRef<PickScene | null>(null);

  // Stop spin while the edit dialog is open or an entity is being dragged
  const isEditing = showDialog || mapDialog !== null || entityDragging;

  // Dot picking/hover is off on the landing preview, in placement mode,
  // while picking a warp-gate endpoint, while dragging map entities, and
  // while any dialog is open.
  const hoverActive =
    !compact && !placeKind && !lanePick && !highlightedStar && !isEditing;

  // The dot the highlight ring follows and the click/Enter target.
  const activeDot = keyDot ?? hoverDot;
  const effectiveRotationSpeed = rotating && !isEditing ? 0.03 : 0;

  // Placed atlas geometry (derived deterministically from the ordered lists).
  // While an entity is dragged, its live position overrides the stored one so
  // markers, child scatter, warp gates, and lanes all follow the cursor.
  const activeSectors = useMemo(
    () =>
      entityDrag?.kind === "sector"
        ? mapSectors.map((s) =>
            s.id === entityDrag.id ? { ...s, pos: entityDrag.pos } : s,
          )
        : mapSectors,
    [mapSectors, entityDrag],
  );
  const activeSystems = useMemo(
    () =>
      entityDrag?.kind === "system"
        ? mapSystems.map((s) =>
            s.id === entityDrag.id ? { ...s, pos: entityDrag.pos } : s,
          )
        : mapSystems,
    [mapSystems, entityDrag],
  );
  const placedQuadrants = useMemo(
    () => placeQuadrants(mapQuadrants),
    [mapQuadrants],
  );
  const placedSectors = useMemo(
    () => placeSectors(activeSectors, placedQuadrants),
    [activeSectors, placedQuadrants],
  );
  const placedSystems = useMemo(
    () => placeSystems(activeSystems, placedSectors),
    [activeSystems, placedSectors],
  );

  /** Stop the spin and fly the camera to a galaxy-local point. The point is
   *  rotated into world space using the frozen angle at the moment of the
   *  click, so the target sits exactly where the content currently is. */
  const navigateTo = useCallback(
    (localPos: [number, number, number], distance: number) => {
      setRotating(false);
      const world = spinPoint(localPos, spinRef.current);
      cameraApiRef.current?.flyTo(
        new THREE.Vector3(world[0], world[1], world[2]),
        distance,
      );
    },
    [],
  );

  // Open the lore dialog to create a star exactly on a background dot.
  const openDotStar = useCallback((dot: GalaxyDot) => {
    setRotating(false);
    setSelectedStar(draftFromDot(dot));
    setNewStar(true);
    setShowDialog(true);
    setKeyDot(null);
  }, []);

  // ---- Warp-gate endpoint picking -----------------------------------------
  // The editor hands us its in-progress draft and closes; a click on the map
  // (or on a star / system / atlas label) snaps to an endpoint id and the
  // editor remounts with that id merged back into the draft.
  const beginLanePick = useCallback(
    (which: "from" | "to", draft: LaneDraft) => {
      setPlaceKind(null);
      setKeyDot(null);
      setRotating(false);
      setLaneDraft(draft);
      setShowLanes(false);
      setLanePick({ which, draft });
    },
    [],
  );

  const completeLanePick = useCallback(
    (endpointId: string | null) => {
      if (!lanePick) return;
      const next: LaneDraft = endpointId
        ? {
            ...lanePick.draft,
            ...(lanePick.which === "from"
              ? { fromId: endpointId }
              : { toId: endpointId }),
          }
        : lanePick.draft;
      setLaneDraft(next);
      setLanePick(null);
      setShowLanes(true);
    },
    [lanePick],
  );

  // Click on empty space → create a lore star on the dot under the cursor,
  // or on the keyboard-selected dot when arrow-key navigation is active.
  const handleFieldPick = useCallback(
    (e: MouseEvent) => {
      const scene = pickSceneRef.current;
      if (!scene || compact || placeKind || lanePick || entityDragging || builderPlacementMode) return;
      const dot =
        keyDot ??
        pickGalaxyDot(
          scene.camera,
          { left: 0, top: 0, width: scene.width, height: scene.height },
          e.offsetX,
          e.offsetY,
          spinRef.current,
          getGalaxyData(),
        );
      if (!dot) return;
      openDotStar(dot);
    },
    [compact, placeKind, lanePick, entityDragging, builderPlacementMode, keyDot, openDotStar],
  );

  // Pointer activity hands control back from arrow-key navigation.
  const handleHoverDot = useCallback((dot: GalaxyDot | null) => {
    setKeyDot(null);
    setHoverDot(dot);
  }, []);

  // ---- Click-to-place: stars anywhere, sectors inside their quadrant ----
  const handlePlace = useCallback(
    (position: [number, number, number]) => {
      setRotating(false);
      if (placeKind === "star") {
        setPlaceKind(null);
        setSelectedStar({
          id: `lore-${crypto.randomUUID()}`,
          name: "New lore star",
          defaultName: "New lore star",
          position,
          color: "#ffcc66",
          size: 1,
          temperature: 5800,
          magnitude: 1,
          isCustom: true,
        });
        setNewStar(true);
        setShowDialog(true);
        return;
      }
      if (placeKind === "sector") {
        // The clicked angle decides which quadrant owns the new sector.
        const angle = Math.atan2(position[2], position[0]);
        const twoPi = Math.PI * 2;
        const quad =
          placedQuadrants.find((q) => {
            const rel = (((angle - q.wedge.start) % twoPi) + twoPi) % twoPi;
            return rel < q.wedge.end - q.wedge.start;
          }) ?? placedQuadrants[0];
        if (!quad) return; // create a quadrant first
        setPlaceKind(null);
        setCreateSectorAt({
          parentId: quad.id,
          parentLabel: quad.name,
          position,
        });
      }
      if (placeKind === "gate") {
        setGateError(null);
        const round = (p: [number, number, number]): [number, number, number] => [
          Math.round(p[0] * 1e4) / 1e4,
          Math.round(p[1] * 1e4) / 1e4,
          Math.round(p[2] * 1e4) / 1e4,
        ];
        // Close to the selected system → a system-level gate (unlimited).
        if (selectedSystemId) {
          const sys = placedSystems.find((s) => s.id === selectedSystemId);
          const cam = pickSceneRef.current?.camera;
          if (sys && cam) {
            const world = spinPoint(sys.position, spinRef.current);
            const d = cam.position.distanceTo(
              new THREE.Vector3(world[0], world[1], world[2]),
            );
            if (d < 1) {
              setPlaceKind(null);
              setCreateGateAt({
                level: "system",
                parentId: sys.id,
                parentLabel: sys.name,
                defaultName: `${sys.name} Gate`,
                defaultColor: sys.color,
                position: round(position),
              });
              return;
            }
          }
        }
        // Sector view: the gate belongs to the focused sector (unlimited).
        if (focus.level === "sector") {
          const sec = placedSectors.find((s) => s.id === focus.sectorId);
          if (sec) {
            setPlaceKind(null);
            setCreateGateAt({
              level: "sector",
              parentId: sec.id,
              parentLabel: sec.name,
              defaultName: `${sec.name} Gate`,
              defaultColor: sec.color,
              position: round(position),
            });
            return;
          }
        }
        // Galaxy / quadrant views: the clicked angle picks the owning
        // quadrant. At galaxy level this creates that quadrant's hub — capped
        // at exactly one per quadrant (four hubs on the default atlas).
        const gateAngle = Math.atan2(position[2], position[0]);
        const gateTwoPi = Math.PI * 2;
        const gateQuad =
          placedQuadrants.find((q) => {
            const rel =
              (((gateAngle - q.wedge.start) % gateTwoPi) + gateTwoPi) % gateTwoPi;
            return rel < q.wedge.end - q.wedge.start;
          }) ?? placedQuadrants[0];
        if (!gateQuad) {
          setGateError("Create a quadrant first");
          return;
        }
        const gateLevel: WarpGateLevel =
          focus.level === "quadrant" ? "quadrant" : "galaxy";
        if (
          gateLevel === "galaxy" &&
          warpGates.some(
            (g) => g.level === "galaxy" && g.quadrantId === gateQuad.id,
          )
        ) {
          setGateError(`${gateQuad.name} already has its hub — delete it first to replace`);
          return;
        }
        setPlaceKind(null);
        setCreateGateAt({
          level: gateLevel,
          parentId: gateQuad.id,
          parentLabel: gateQuad.name,
          defaultName:
            gateLevel === "galaxy"
              ? `${gateQuad.name} Hub`
              : `${gateQuad.name} Gate`,
          defaultColor: gateQuad.color,
          position: round(position),
        });
      }
    },
    [placeKind, placedQuadrants, placedSectors, placedSystems, focus, selectedSystemId, warpGates],
  );

  // Esc cancels placement mode.
  useEffect(() => {
    if (!placeKind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlaceKind(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [placeKind]);

  // Esc during endpoint picking cancels it and reopens the editor with the
  // snapshot so no typed lane details are lost.
  useEffect(() => {
    if (!lanePick) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") completeLanePick(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lanePick, completeLanePick]);

  // ---- Dragging atlas entities to new map positions ----
  const handleEntityDragState = useCallback((dragging: boolean) => {
    setEntityDragging(dragging);
    if (dragging) setRotating(false);
  }, []);

  const handleMoveEntity = useCallback(
    async (
      kind: DraggableEntity,
      id: string,
      pos: [number, number, number] | null,
    ) => {
      setEntityDragging(false);
      const list = kind === "sector" ? mapSectors : mapSystems;
      const entity = list.find((e) => e.id === id);
      if (!pos || !entity) {
        setEntityDrag(null);
        return;
      }
      const rounded: [number, number, number] = [
        Math.round(pos[0] * 1e4) / 1e4,
        Math.round(pos[1] * 1e4) / 1e4,
        Math.round(pos[2] * 1e4) / 1e4,
      ];
      try {
        // Keep the live override until the update lands so the entity does
        // not snap back to its stored position in between.
        await mapCrud.update(kind, id, {
          name: entity.name,
          description: entity.description,
          color: entity.color,
          position: rounded,
        });
      } finally {
        setEntityDrag(null);
      }
    },
    [mapSectors, mapSystems, mapCrud],
  );

  // ---- Star selection: stop spin + auto-zoom to the star's system ----
  const handleStarClick = useCallback(
    (star: StarData) => {
      if (builderPlacementMode) return;
      if (lanePick) {
        completeLanePick(star.id); // pick this star as the gate endpoint
        return;
      }
      if (placeKind) return; // while placing, clicks create map entities
      setSelectedStar(star);
      setNewStar(false);
      setShowDialog(true); // click a star → create / edit its lore directly
      navigateTo(star.position, Math.max(DIST_STAR, starRadius(star) * 5));
    },
    [navigateTo, placeKind, lanePick, completeLanePick, builderPlacementMode],
  );

  const handleBuilderPlace = useCallback(
    (position: [number, number, number]) => {
      const angle = Math.atan2(position[2], position[0]);
      const radius = Math.hypot(position[0], position[2]);
      const contains = (sector: (typeof placedSectors)[number]) => {
        const span = sector.wedge.end - sector.wedge.start;
        const relative = (((angle - sector.wedge.start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        return relative < span && radius >= sector.inner && radius <= sector.outer;
      };
      const sector = placedSectors.find(contains) ?? [...placedSectors].sort((a, b) => {
        const da = Math.hypot(a.center[0] - position[0], a.center[2] - position[2]);
        const db = Math.hypot(b.center[0] - position[0], b.center[2] - position[2]);
        return da - db;
      })[0];
      setRotating(false);
      onBuilderPlace?.(position, sector?.id ?? "");
    },
    [placedSectors, onBuilderPlace],
  );

  const handleHoverStar = useCallback(
    (starId: string | null) => {
      if (starId === null) {
        setHighlightedStar(null);
      } else {
        const star = stars.find((s) => s.id === starId);
        if (star) setHighlightedStar(star);
      }
    },
    [stars],
  );

  const handleSaveName = useCallback(async (star: StarData, name: string, category: StarCategory, notes: string) => {
    const wasNew = newStar;
    await onSetStarName(star.id, name, star, category, notes);
    setSelectedStar(star);
    setNewStar(false);
    // A brand-new lore star gets its own atlas system sitting exactly on the
    // star, filed under the nearest sector (same rule as the initial seeding).
    if (wasNew && placedSectors.length > 0) {
      let best = placedSectors[0];
      let bestDist = Infinity;
      for (const sec of placedSectors) {
        const dx = sec.center[0] - star.position[0];
        const dz = sec.center[2] - star.position[2];
        const d = dx * dx + dz * dz;
        if (d < bestDist) {
          bestDist = d;
          best = sec;
        }
      }
      await mapCrud.create("system", best.id, {
        name,
        description: "",
        color: star.color,
        position: star.position,
        starId: star.id,
      });
    }
    navigateTo(star.position, Math.max(DIST_STAR, starRadius(star) * 5));
  }, [onSetStarName, navigateTo, newStar, placedSectors, mapCrud]);

  const handleResetName = useCallback(async () => {
    if (selectedStar) {
      await onResetStarName(selectedStar.id);
      setSelectedStar(null);
    }
  }, [selectedStar, onResetStarName]);

  // Warp gate endpoints on every level: quadrants, gates, sectors, systems,
  // and stars — hubs rank with quadrants, finer gates with terminal anchors.
  const endpoints = useMemo(() => [
    ...placedQuadrants.map(q => ({ id: q.id, name: q.name, kind: "Quadrant", position: q.center })),
    ...warpGates.map(g => ({ id: g.id, name: g.name, kind: g.level === "galaxy" ? "Hub" : "Gate", position: g.position })),
    ...placedSectors.map(s => ({ id: s.id, name: s.name, kind: "Sector", position: s.center })),
    ...placedSystems.map(s => ({ id: s.id, name: s.name, kind: "System", position: s.position })),
    ...stars.map(s => ({ id: s.id, name: starNames[s.id] || s.defaultName, kind: "Star", position: s.position })),
  ], [placedQuadrants, warpGates, placedSectors, placedSystems, stars, starNames]);

  // A map click while picking snaps to the best endpoint (reference stars
  // preferred) and hands it back to the lane editor.
  const handleLanePickPlace = useCallback(
    (position: [number, number, number]) => {
      const snap = snapWarpEndpoint(position, endpoints);
      completeLanePick(snap?.id ?? null);
    },
    [endpoints, completeLanePick],
  );
  const placedLanes = useMemo(() => warpLanes.flatMap(lane => {
    const from = endpoints.find(e => e.id === lane.fromId);
    const to = endpoints.find(e => e.id === lane.toId);
    return from && to ? [{
      ...lane,
      from: from.position,
      to: to.position,
      // Color-coded by level unless the user chose a custom color.
      color: laneColor(lane.customColor, lane.color, from.kind, to.kind),
    }] : [];
  }), [warpLanes, endpoints]);

  const getStarName = useCallback(
    (star: StarData) => starNames[star.id] || star.defaultName,
    [starNames],
  );

  // ---- Atlas navigation ----
  const focusGalaxy = useCallback(() => {
    setFocus({ level: "galaxy" });
    setSelectedSystemId(null);
    navigateTo([0, 0, 0], DIST_GALAXY);
  }, [navigateTo]);

  const focusQuadrant = useCallback(
    (id: string) => {
      const quad = placedQuadrants.find((q) => q.id === id);
      if (!quad) return;
      setFocus({ level: "quadrant", quadrantId: id });
      setSelectedSystemId(null);
      navigateTo(quad.center, DIST_QUADRANT);
    },
    [placedQuadrants, navigateTo],
  );

  const focusSector = useCallback(
    (id: string) => {
      const sec = placedSectors.find((s) => s.id === id);
      if (!sec) return;
      setFocus({ level: "sector", sectorId: id });
      setSelectedSystemId(null);
      navigateTo(sec.center, DIST_SECTOR);
    },
    [placedSectors, navigateTo],
  );

  const selectSystem = useCallback(
    (system: PlacedStarSystem) => {
      setSelectedSystemId(system.id);
      // Fly in like the praised 47 Ursa Majoris close-up: stop a few stellar
      // radii out so the shader star fills the view instead of a distant dot.
      const nearStar = stars.find((s) => {
        const dx = s.position[0] - system.position[0];
        const dy = s.position[1] - system.position[1];
        const dz = s.position[2] - system.position[2];
        return dx * dx + dy * dy + dz * dz < 0.03 * 0.03;
      });
      const radius = nearStar ? starRadius(nearStar) : SYSTEM_STAR_RADIUS;
      navigateTo(system.position, Math.max(DIST_STAR, radius * 5));
    },
    [navigateTo, stars],
  );

  const selectSystemById = useCallback(
    (id: string) => {
      const sys = placedSystems.find((s) => s.id === id);
      if (sys) selectSystem(sys);
    },
    [placedSystems, selectSystem],
  );

  // ---- Map entity editing from the canvas (click a system to edit lore) ----
  const openMapDialog = useCallback((kind: MapEntityKind, id: string) => {
    setMapDialog({ kind, id });
  }, []);

  const mapDialogEntity = useMemo(() => {
    if (!mapDialog) return null;
    if (mapDialog.kind === "gate") {
      const gate = warpGates.find((g) => g.id === mapDialog.id);
      return gate
        ? { name: gate.name, description: gate.description, color: gate.color }
        : null;
    }
    const list =
      mapDialog.kind === "quadrant"
        ? mapQuadrants
        : mapDialog.kind === "sector"
          ? mapSectors
          : mapSystems;
    const found = list.find((e) => e.id === mapDialog.id);
    return found
      ? {
          name: found.name,
          description: found.description,
          color: found.color,
        }
      : null;
  }, [mapDialog, mapQuadrants, mapSectors, mapSystems, warpGates]);

  const handleMapDialogSave = useCallback(
    async (draft: MapEntityDraft) => {
      if (!mapDialog) return;
      await mapCrud.update(mapDialog.kind, mapDialog.id, draft);
      setMapDialog(null);
    },
    [mapDialog, mapCrud],
  );

  const handleMapDialogDelete = useCallback(async () => {
    if (!mapDialog) return;
    await mapCrud.remove(mapDialog.kind, mapDialog.id);
    setMapDialog(null);
  }, [mapDialog, mapCrud]);

  return (
    <div className={`relative w-full h-full ${placeKind ? "cursor-crosshair" : ""}`}>
      <Canvas
        onPointerMissed={handleFieldPick}
        camera={{
          position: [20, 10, 20],
          fov: compact ? 45 : 50,
          near: 0.00001,
          far: 400,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{ background: "#000005" }}
        onCreated={({ gl }) => {
          gl.setClearColor("#000005");
        }}
      >
        {/* Advances the shared spin angle first each frame */}
        <RotationDriver spinRef={spinRef} speed={effectiveRotationSpeed} />

        {/* Hands camera/size to the DOM-side star-dot picker */}
        <PickBridge targetRef={pickSceneRef} />

        {/* Hover tracking, arrow-key browsing, and highlight for star dots */}
        <FieldHover
          active={hoverActive}
          spinRef={spinRef}
          onHover={handleHoverDot}
          selected={activeDot}
          onSelect={setKeyDot}
          onActivate={openDotStar}
        />
        <DotHighlight dot={activeDot} active={hoverActive} spinRef={spinRef} />

        {/* Background stars (far field) */}
        <FarFieldStars />

        {/* Unnamed background stars, with round glow sprites */}
        <MilkyWay spinRef={spinRef} />

        {/* Sol is now a true-position catalog star, not an oversized marker. */}

        {/* Clickable prominent stars — part of the Systems layer, so the
            layer toggle hides both the stars and their labels. */}
        {layers.systems && stars.length > 0 && (
          <ClickableStars
            stars={stars}
            onStarClick={handleStarClick}
            selectedStarId={selectedStar?.id ?? null}
            highlightedStarId={highlightedStar?.id ?? null}
            onHoverStar={handleHoverStar}
            spinRef={spinRef}
          />
        )}

        {/* Persistent labels on known stars (rotates with the galaxy) */}
        {layers.systems && stars.length > 0 && (
          <StarLabels
            stars={stars}
            starNames={starNames}
            selectedStarId={selectedStar?.id ?? null}
            highlightedStarId={highlightedStar?.id ?? null}
            limit={stars.length}
            onSelectStar={handleStarClick}
            spinRef={spinRef}
          />
        )}

        {/* Small, screen-space labels continue to work at catalog-scale zoom. */}

        {/* Galactic atlas: quadrant wedges, sectors, systems, warp lanes */}
        {!compact && (
          <RotGroup spinRef={spinRef}>
            <MapView
              focus={focus}
              quadrants={placedQuadrants}
              sectors={placedSectors}
              systems={placedSystems}
              stars={stars}
              spinRef={spinRef}
              dragEnabled={placeKind === null && lanePick === null && !readOnly && !builderPlacementMode}
              layers={{ sectors: layers.sectors, systems: layers.systems }}
              onDragStateChange={handleEntityDragState}
              onDragEntity={setEntityDrag}
              onMoveEntity={handleMoveEntity}
              onFocusQuadrant={(id) => {
                if (lanePick) {
                  completeLanePick(id);
                  return;
                }
                if (!placeKind && !builderPlacementMode) focusQuadrant(id);
              }}
              onFocusSector={(id) => {
                if (lanePick) {
                  completeLanePick(id);
                  return;
                }
                if (!placeKind && !builderPlacementMode) focusSector(id);
              }}
              onSelectSystem={(sys) => {
                if (lanePick) {
                  completeLanePick(sys.id);
                  return;
                }
                if (placeKind || builderPlacementMode) return;
                selectSystem(sys);
                openMapDialog("system", sys.id);
              }}
              selectedSystemId={selectedSystemId}
            />
          </RotGroup>
        )}

        {/* Spiral arm names, visible while looking at the whole galaxy */}
        {!compact && focus.level === "galaxy" && (
          <ArmLabels spinRef={spinRef} />
        )}

        {/* User-created warp lanes: two gates connected by a labeled line */}
        <RotGroup spinRef={spinRef}>
          {placedLanes.map(lane => {
            const mid: [number, number, number] = [(lane.from[0]+lane.to[0])/2, (lane.from[1]+lane.to[1])/2+0.8, (lane.from[2]+lane.to[2])/2];
            return <group key={lane.id}>
              <Line points={[lane.from, mid, lane.to]} color={lane.color} lineWidth={2.5} depthTest={false} transparent opacity={0.9} />
              <WarpGate position={lane.from} color={lane.color} />
              <WarpGate position={lane.to} color={lane.color} />
              {!readOnly && (
                <Html position={mid} center zIndexRange={[10, 0]}><button onClick={() => { if (lanePick) return; setLaneEditId(lane.id); setShowLanes(true); }} title={`Edit ${lane.name}`} className="whitespace-nowrap rounded border bg-slate-950/90 px-2 py-1 text-[10px] hover:bg-slate-800/90" style={{ color: lane.color, borderColor: lane.color }}>{lane.name} ✎</button></Html>
              )}
            </group>;
          })}
        </RotGroup>

        {/* Warp gate nodes — quadrant hubs (galaxy level, one per quadrant)
            plus unlimited gates at the quadrant / sector / system levels. */}
        <RotGroup spinRef={spinRef}>
          {warpGates
            .filter((g) => (g.level === "galaxy" ? layers.hubs : layers.gates))
            .map((g) => {
              const label: [number, number, number] = [
                g.position[0],
                g.position[1] + 0.6,
                g.position[2],
              ];
              return (
                <group key={g.id}>
                  <WarpGate position={g.position} color={g.color} />
                  <Html
                    position={label}
                    center
                    zIndexRange={[10, 0]}
                    style={{ pointerEvents: "auto" }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (lanePick || placeKind) return;
                        setMapDialog({ kind: "gate", id: g.id });
                      }}
                      title={`Edit ${g.name}`}
                      className="whitespace-nowrap rounded border bg-slate-950/90 px-2 py-1 text-[10px] hover:bg-slate-800/90"
                      style={{ color: g.color, borderColor: g.color }}
                    >
                      {g.level === "galaxy" ? "◈ " : "✧ "}
                      {g.name} ✎
                    </button>
                  </Html>
                </group>
              );
            })}
        </RotGroup>

        {/* Ambient light for mesh visibility */}
        <ambientLight intensity={0.1} />

        {/* Controls — camera never auto-spins; zoom handled by CameraRig */}
        <OrbitControls
          makeDefault
          enabled={!entityDragging}
          enablePan={!compact}
          enableZoom={false}
          enableRotate={true}
          autoRotate={false}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: undefined }}
          minDistance={selectedStar ? Math.max(ZOOM_MIN, starRadius(selectedStar) * 1.2) : ZOOM_MIN}
          maxDistance={ZOOM_MAX}
        />

        {/* All camera motion: wheel, pinch, right-drag, ↑↓ keys, fly-to */}
        <CameraRig apiRef={cameraApiRef} minDistance={selectedStar ? Math.max(ZOOM_MIN, starRadius(selectedStar) * 1.2) : ZOOM_MIN} />

        {/* Click-to-place: maps map clicks to galaxy-local positions */}
        <PlacementClicker active={placeKind !== null} spinRef={spinRef} onPlace={handlePlace} />
        {/* Lore pin placement shares the real galaxy camera, projection and click plane. */}
        <PlacementClicker active={builderPlacementMode} spinRef={spinRef} onPlace={handleBuilderPlace} />
        {/* Gate picking: map clicks snap to the nearest warp endpoint */}
        <PlacementClicker active={lanePick !== null} spinRef={spinRef} onPlace={handleLanePickPlace} />
      </Canvas>

      <div className="absolute bottom-16 right-4 z-10 max-w-48 rounded bg-slate-950/80 p-2 text-[9px] text-slate-400">
        Catalog: <a href="https://www.astronexus.com/projects/hyg" target="_blank" rel="noreferrer" className="underline">HYG v3 / David Nash</a> · <a href="https://creativecommons.org/licenses/by-sa/2.5/" target="_blank" rel="noreferrer" className="underline">CC BY-SA 2.5</a>. J2000 positions; 620 pc/unit. Stellar radii exaggerated. Nearby stars cluster near Sol; select them in Star Lore to inspect.
      </div>

      {/* Top-right controls (plain DOM, reliable in iframes and new tabs) */}
      {!compact && !builderPlacementMode && (
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          {!readOnly && (<>
          <button
            className={`rounded-lg border px-3 py-2 text-xs transition-all ${
              placeKind === "star"
                ? "border-amber-200 bg-amber-300/20 text-amber-100"
                : "border-amber-300/40 bg-slate-950/90 text-amber-200"
            }`}
            title="Click the galactic map to place a new lore star"
            onClick={() => {
              if (lanePick) return;
              setPlaceKind((k) => (k === "star" ? null : "star"));
              setShowDialog(false);
              setRotating(false);
            }}
          >
            {placeKind === "star" ? "✕ Cancel placement" : "+ Place star"}
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-xs transition-all ${
              placeKind === "sector"
                ? "border-amber-200 bg-amber-300/20 text-amber-100"
                : "border-amber-300/40 bg-slate-950/90 text-amber-200"
            }`}
            title="Click the map inside a quadrant to create a sector there"
            onClick={() => {
              if (lanePick) return;
              setPlaceKind((k) => (k === "sector" ? null : "sector"));
              setShowDialog(false);
              setRotating(false);
            }}
          >
            {placeKind === "sector" ? "✕ Cancel placement" : "+ Place sector"}
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-xs transition-all ${
              placeKind === "gate"
                ? "border-cyan-200 bg-cyan-300/20 text-cyan-100"
                : "border-cyan-300/40 bg-slate-950/90 text-cyan-200"
            }`}
            title="Click the map to place a warp gate node — galaxy view creates that quadrant's hub (one per quadrant)"
            onClick={() => {
              if (lanePick) return;
              setPlaceKind((k) => (k === "gate" ? null : "gate"));
              setGateError(null);
              setShowDialog(false);
              setRotating(false);
            }}
          >
            {placeKind === "gate" ? "✕ Cancel placement" : "+ Place gate"}
          </button>
          <button className="rounded-lg border border-cyan-300/40 bg-slate-950/90 px-3 py-2 text-xs text-cyan-200" onClick={() => { if (lanePick) completeLanePick(null); else setShowLanes(true); }}>Warp gate lanes</button>
          </>)}
          <button
            className={`rounded-lg border px-3 py-2 text-xs transition-all ${
              showLayers
                ? "border-white/40 bg-slate-950/90 text-white"
                : "border-white/15 bg-slate-950/90 text-white/60"
            }`}
            title="Filter the map: quadrant hubs, sectors, systems, warp gate nodes"
            onClick={() => setShowLayers((v) => !v)}
          >
            ◈ Layers
          </button>
          {showLayers && (
            <div className="rounded-lg border border-white/15 bg-slate-950/95 p-3 text-left shadow-lg">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Map layers
              </p>
              {([
                ["hubs", "Quadrant hubs", "#facc15"],
                ["sectors", "Sectors", "#38bdf8"],
                ["systems", "Systems", "#a78bfa"],
                ["gates", "Warp gate nodes", "#22d3ee"],
              ] as const).map(([key, label, dot]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 py-0.5 text-xs text-slate-200"
                >
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() =>
                      setLayers((l) => {
                        const next = { ...l };
                        next[key] = !next[key];
                        return next;
                      })
                    }
                    className="accent-cyan-300"
                  />
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: dot }}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
          {selectedStar && !readOnly && <button className="rounded-lg border border-white/20 bg-slate-950/90 px-3 py-2 text-xs" onClick={() => setShowDialog(true)}>Edit selected star</button>}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="px-3 py-2 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white/80 text-xs font-medium hover:bg-black/80 hover:border-white/20 transition-all"
          >
            {showSidebar ? "Hide Lore" : "Star Lore"}
          </button>
          <button
            onClick={() => setRotating((r) => !r)}
            className={`px-3 py-2 rounded-lg backdrop-blur-sm border text-xs font-medium transition-all ${
              rotating
                ? "bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25"
                : "bg-black/60 border-white/10 text-white/60 hover:bg-black/80 hover:border-white/20"
            }`}
            title={
              rotating
                ? "Stop the galaxy from spinning"
                : "Start the galaxy spinning"
            }
          >
            {rotating ? "◼ Stop Rotation" : "▶ Start Rotation"}
          </button>
        </div>
      )}

      {/* Control legend — the top-center strip is reserved for placement
          prompts, so the legend yields to them. Hidden in compact embeds. */}
      {!compact && !builderPlacementMode && !placeKind && !lanePick && (
        <div className="absolute left-1/2 top-4 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2">
          {showControls ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1.5 backdrop-blur-sm">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
                <Keyboard className="h-3 w-3" aria-hidden />
                Controls
              </span>
              {CONTROL_HINTS.map((hint) => (
                <span
                  key={`${hint.keys.join("+")}:${hint.label}`}
                  className="flex items-center gap-1 whitespace-nowrap"
                >
                  <span className="flex items-center gap-0.5">
                    {hint.keys.map((k) => (
                      <kbd
                        key={k}
                        className="rounded border border-white/15 bg-white/[0.06] px-1 py-px font-mono text-[10px] text-white/70"
                      >
                        {k}
                      </kbd>
                    ))}
                  </span>
                  <span className="text-[10px] text-white/40">{hint.label}</span>
                </span>
              ))}
              <button
                type="button"
                onClick={() => setShowControls(false)}
                aria-label="Hide the atlas control legend"
                title="Hide the control legend"
                className="rounded-full border border-white/10 px-1.5 text-[10px] text-white/50 hover:border-white/20 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowControls(true)}
              aria-label="Show the atlas control legend"
              title="Show the control legend"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[10px] text-white/60 backdrop-blur-sm hover:border-white/20 hover:text-white transition-colors"
            >
              <Keyboard className="h-3 w-3" aria-hidden />
              Controls
            </button>
          )}
        </div>
      )}

      {/* Placement hint */}
      {builderPlacementMode && (
        <div className="absolute left-1/2 top-4 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg border border-cyan-200/40 bg-slate-950/95 px-4 py-3 text-xs text-cyan-50 shadow-xl">
          <Crosshair className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
          <span>Pin your lore discovery on the 3D chart. Drag to orbit; click the galactic plane to set coordinates.</span>
          <button type="button" onClick={onCancelBuilderPlacement} className="shrink-0 rounded border border-white/20 px-2 py-1 text-white/70 hover:text-white">Cancel</button>
        </div>
      )}
      {placeKind && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-amber-300/40 bg-slate-950/90 px-4 py-2 text-xs text-amber-100">
          {placeKind === "star"
            ? "Click anywhere on the galactic map to place a lore star"
            : placeKind === "gate"
              ? gateError ??
                (focus.level === "galaxy"
                  ? `Click the map to create that quadrant's warp-gate hub (${warpGates.filter((g) => g.level === "galaxy").length}/4 placed)`
                  : "Click the map to place a warp gate — unlimited at this level")
              : "Click the map to create a sector at that spot (inside its quadrant)"}{" "}
          · Esc to cancel
        </div>
      )}

      {/* Warp-gate endpoint picking hint */}
      {lanePick && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-cyan-300/40 bg-slate-950/90 px-4 py-2 text-xs text-cyan-100">
          Click the map to choose the {lanePick.which === "from" ? "From" : "To"} warp gate — snaps to the nearest warp gate or reference star{" "}
          · Esc to cancel
        </div>
      )}

      {selectedStar && !showDialog && <div className="absolute left-4 top-4 z-20 max-w-[min(280px,calc(100%-8rem))] rounded-xl border border-amber-300/30 bg-slate-950/90 p-4 text-white">
        <p className="text-xs text-amber-200">{selectedStar.designation ?? (selectedStar.isReal ? "Real reference star" : "Lore star")}</p>
        <h2 className="mt-1 font-semibold">{getStarName(selectedStar)}</h2>
        <p className="mt-1 text-xs text-slate-400">{Math.round(selectedStar.temperature).toLocaleString()} K · {selectedStar.isReal ? `${selectedStar.distancePc?.toFixed(2)} pc from Sol` : "Canon atlas coordinates"}</p>
        <p className="mt-2 line-clamp-3 text-xs text-slate-300">{loreNotes[selectedStar.id] || "No lore yet. Turn this star into part of your universe."}</p>
        {!readOnly && <button onClick={() => setShowDialog(true)} className="mt-3 text-xs text-amber-200 underline">Edit star lore</button>}
        <button onClick={() => { setSelectedStar(null); focusGalaxy(); }} className="ml-3 mt-3 text-xs text-slate-400 underline">Back to galaxy</button>
      </div>}

      {/* Camera buttons — slide the map up/down, then zoom */}
      {!compact && (
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => cameraApiRef.current?.panUp()}
            aria-label="Slide the map up"
            title="Slide the map up (↑ arrow / W / middle-drag)"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/80 hover:border-white/20 hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer select-none"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => cameraApiRef.current?.panDown()}
            aria-label="Slide the map down"
            title="Slide the map down (↓ arrow / S / middle-drag)"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/80 hover:border-white/20 hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer select-none"
          >
            ▼
          </button>
          <span aria-hidden className="h-1.5" />
          <button
            type="button"
            onClick={() => cameraApiRef.current?.zoomIn()}
            aria-label="Zoom in"
            title="Zoom in (scroll wheel / pinch / + key)"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/80 hover:border-white/20 hover:scale-105 active:scale-95 transition-all text-sm font-light cursor-pointer select-none"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => cameraApiRef.current?.zoomOut()}
            aria-label="Zoom out"
            title="Zoom out (scroll wheel / pinch / − key)"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/80 hover:border-white/20 hover:scale-105 active:scale-95 transition-all text-sm font-light cursor-pointer select-none"
          >
            −
          </button>
        </div>
      )}

      {/* Quadrant navigator overlay (hidden while the editor panel is open) */}
      {!compact && !showMapEditor && !builderPlacementMode && (
        <MapOverlay
          focus={focus}
          quadrants={mapQuadrants}
          sectors={mapSectors}
          systems={mapSystems}
          onFocusGalaxy={focusGalaxy}
          onFocusQuadrant={focusQuadrant}
          onFocusSector={focusSector}
          onSelectSystem={selectSystemById}
          onOpenEditor={readOnly ? undefined : () => setShowMapEditor(true)}
        />
      )}

      {/* CRUD editor for quadrants / sectors / star systems */}
      {!compact && showMapEditor && !builderPlacementMode && (
        <MapEditor
          quadrants={mapQuadrants}
          sectors={mapSectors}
          systems={mapSystems}
          onCreate={(kind, parentId, draft) =>
            mapCrud.create(kind, parentId, draft)
          }
          onUpdate={(kind, id, draft) => mapCrud.update(kind, id, draft)}
          onDelete={(kind, id) => mapCrud.remove(kind, id)}
          onClose={() => setShowMapEditor(false)}
        />
      )}

      {/* Star Name Dialog */}
      {selectedStar && showDialog && (
        <StarDialog
          key={selectedStar.id}
          star={selectedStar}
          isNew={newStar}
          currentName={starNames[selectedStar.id] || selectedStar.defaultName}
          currentNotes={loreNotes[selectedStar.id] || ""}
          currentCategory={starCategories[selectedStar.id] || "none"}
          isOpen={showDialog}
          readOnly={readOnly}
          onSave={handleSaveName}
          onReset={handleResetName}
          onClose={() => setShowDialog(false)}
        />
      )}

      {showLanes && <WarpLaneEditor lanes={warpLanes} endpoints={endpoints} crud={warpCrud} initialLaneId={laneEditId} initialDraft={laneDraft} onPickMap={beginLanePick} onClose={() => { setShowLanes(false); setLaneEditId(undefined); setLaneDraft(null); }} />}

      {/* Create a sector at a clicked map position */}
      {createSectorAt && (
        <MapEntityDialog
          key={`sector:${createSectorAt.parentId}:${createSectorAt.position.join(",")}`}
          kind="sector"
          entity={null}
          parentLabel={createSectorAt.parentLabel}
          isOpen={true}
          onSave={async (draft) => {
            await mapCrud.create("sector", createSectorAt.parentId, {
              ...draft,
              position: createSectorAt.position,
            });
            setCreateSectorAt(null);
          }}
          onClose={() => setCreateSectorAt(null)}
        />
      )}

      {/* Create a warp gate node at a clicked map position */}
      {createGateAt && (
        <MapEntityDialog
          key={`gate:${createGateAt.level}:${createGateAt.parentId}:${createGateAt.position.join(",")}`}
          kind="gate"
          entity={null}
          parentLabel={createGateAt.parentLabel}
          defaultName={createGateAt.defaultName}
          defaultColor={createGateAt.defaultColor}
          isOpen={true}
          onSave={async (draft) => {
            await mapCrud.create("gate", createGateAt.parentId, {
              ...draft,
              gateLevel: createGateAt.level,
              position: createGateAt.position,
            });
            setCreateGateAt(null);
          }}
          onClose={() => setCreateGateAt(null)}
        />
      )}

      {/* Edit dialog for a star system clicked directly on the map */}
      {mapDialog && (
        <MapEntityDialog
          key={`${mapDialog.kind}:${mapDialog.id}`}
          kind={mapDialog.kind}
          entity={mapDialogEntity}
          isOpen={true}
          readOnly={readOnly}
          onSave={handleMapDialogSave}
          onDelete={handleMapDialogDelete}
          onClose={() => setMapDialog(null)}
        />
      )}

      {/* Lore Sidebar */}
      {!compact && showSidebar && (
        <LoreSidebar
          stars={stars}
          starNames={starNames}
          loreNotes={loreNotes}
          starCategories={starCategories}
          onSelectStar={handleStarClick}
          onClose={() => setShowSidebar(false)}
        />
      )}
    </div>
  );
}

// Captures clicks on the galactic plane while placement mode is active and
// reports the clicked point in galaxy-local coordinates.
function PlacementClicker({
  active,
  spinRef,
  onPlace,
}: {
  active: boolean;
  spinRef: SpinRef;
  onPlace: (position: [number, number, number]) => void;
}) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const onPlaceRef = useRef(onPlace);
  useEffect(() => {
    onPlaceRef.current = onPlace;
  }, [onPlace]);

  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      // Left button only, and only for genuine clicks (not camera drags).
      if (e.button !== 0) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > PLACE_DRAG_THRESHOLD)
        return;
      const local = clickToGalaxyLocal(
        camera,
        el.getBoundingClientRect(),
        e.clientX,
        e.clientY,
        spinRef.current,
      );
      if (local) onPlaceRef.current(local);
    };
    el.addEventListener("pointerdown", onDown, true);
    el.addEventListener("pointerup", onUp, true);
    return () => {
      el.removeEventListener("pointerdown", onDown, true);
      el.removeEventListener("pointerup", onUp, true);
    };
  }, [active, camera, gl, spinRef]);

  return null;
}

// A warp gate: concentric rings at a lane endpoint, kept at a constant
// screen size so gates stay visible from galaxy view down to close zoom.
function WarpGate({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  const group = useRef<THREE.Group>(null);
  const scratch = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    if (!group.current) return;
    group.current.getWorldPosition(scratch.current);
    const d = camera.position.distanceTo(scratch.current);
    const worldPerPixel =
      (2 * d * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360)) /
      size.height;
    group.current.scale.setScalar(Math.max(0.0005, 16 * worldPerPixel));
  });
  return (
    <group ref={group} position={position}>
      <Billboard>
        <mesh raycast={() => null}>
          <ringGeometry args={[0.72, 0.88, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.95} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh raycast={() => null}>
          <ringGeometry args={[1.02, 1.1, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh raycast={() => null}>
          <circleGeometry args={[0.55, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </Billboard>
    </group>
  );
}

/** Lore-star draft for a picked background dot — keeps the dot's look. */
function draftFromDot(dot: GalaxyDot): StarData {
  const rgb = parseInt(dot.color.slice(1), 16);
  const r = ((rgb >> 16) & 255) / 255;
  const g = ((rgb >> 8) & 255) / 255;
  const b = (rgb & 255) / 255;
  const temperature = Math.round(
    3000 + 14000 * Math.pow(b / (r + g + b + 1e-4), 1.4),
  );
  return {
    id: `lore-${crypto.randomUUID()}`,
    name: "New lore star",
    defaultName: "New lore star",
    position: dot.position,
    color: dot.color,
    size: 1,
    temperature,
    magnitude: Math.max(1, 6 - dot.size * 6),
    isCustom: true,
  };
}

/** Hands the R3F camera + canvas size to the DOM-side star-dot picker. */
function PickBridge({ targetRef }: { targetRef: { current: PickScene | null } }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    targetRef.current = { camera, width: size.width, height: size.height };
  }, [camera, size, targetRef]);
  return null;
}

/** Screen-sized ring highlighting the background dot under the cursor. */
function DotHighlight({
  dot,
  active,
  spinRef,
}: {
  dot: GalaxyDot | null;
  active: boolean;
  spinRef: SpinRef;
}) {
  const group = useRef<THREE.Group>(null);
  const scratch = useRef(new THREE.Vector3());
  useFrame((state) => {
    if (!group.current) return;
    const camera = state.camera as THREE.PerspectiveCamera;
    group.current.getWorldPosition(scratch.current);
    const d = camera.position.distanceTo(scratch.current);
    const pxToWorld =
      (2 * d * Math.tan((camera.fov * Math.PI) / 360)) / state.size.height;
    group.current.scale.setScalar(Math.max(1e-4, 22 * pxToWorld));
  });
  return (
    <RotGroup spinRef={spinRef}>
      {active && dot && (
        <group ref={group} position={dot.position}>
          <Billboard>
            <mesh raycast={() => null}>
              <ringGeometry args={[0.78, 1, 48]} />
              <meshBasicMaterial
                color="#7dd3fc"
                transparent
                opacity={0.85}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            <mesh raycast={() => null}>
              <circleGeometry args={[0.78, 32]} />
              <meshBasicMaterial
                color="#7dd3fc"
                transparent
                opacity={0.12}
                depthWrite={false}
              />
            </mesh>
          </Billboard>
        </group>
      )}
    </RotGroup>
  );
}

/** Tracks the background star dot under the cursor (one screen-space pick
 *  per animation frame at most) and handles arrow-key dot browsing. */
function FieldHover({
  active,
  spinRef,
  onHover,
  selected,
  onSelect,
  onActivate,
}: {
  active: boolean;
  spinRef: SpinRef;
  onHover: (dot: GalaxyDot | null) => void;
  selected: GalaxyDot | null;
  onSelect: (dot: GalaxyDot | null) => void;
  onActivate: (dot: GalaxyDot) => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const onHoverRef = useRef(onHover);
  const selectedRef = useRef(selected);
  const onSelectRef = useRef(onSelect);
  const onActivateRef = useRef(onActivate);
  const cursorRef = useRef({ x: -1, y: -1 });
  useEffect(() => {
    onHoverRef.current = onHover;
    selectedRef.current = selected;
    onSelectRef.current = onSelect;
    onActivateRef.current = onActivate;
  }, [onHover, selected, onSelect, onActivate]);
  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    let raf = 0;
    const run = () => {
      raf = 0;
      const dot = pickGalaxyDot(
        camera,
        { left: 0, top: 0, width: size.width, height: size.height },
        cursorRef.current.x,
        cursorRef.current.y,
        spinRef.current,
        getGalaxyData(),
      );
      onHoverRef.current(dot);
      el.style.cursor = dot ? "pointer" : "";
    };
    const onMove = (e: PointerEvent) => {
      cursorRef.current = { x: e.offsetX, y: e.offsetY };
      if (!raf) raf = requestAnimationFrame(run);
    };
    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      onHoverRef.current(null);
      el.style.cursor = "";
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.style.cursor = "";
    };
  }, [active, camera, size, gl, spinRef]);

  // Arrow keys hop the highlight between nearby dots; Enter opens the
  // selected one. Ignored while typing in inputs or with modifiers held.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      )
        return;
      // Shift+arrows browse nearby dots; plain arrows pan/zoom the camera.
      const direction = !e.shiftKey
        ? null
        : e.key === "ArrowUp"
          ? "up"
          : e.key === "ArrowDown"
            ? "down"
            : e.key === "ArrowLeft"
              ? "left"
              : e.key === "ArrowRight"
                ? "right"
                : null;
      if (direction) {
        e.preventDefault();
        if (cursorRef.current.x < 0) {
          cursorRef.current = { x: size.width / 2, y: size.height / 2 };
        }
        const dot = findNeighborDot(
          camera,
          { left: 0, top: 0, width: size.width, height: size.height },
          cursorRef.current.x,
          cursorRef.current.y,
          spinRef.current,
          getGalaxyData(),
          selectedRef.current,
          direction,
        );
        if (dot) onSelectRef.current(dot);
        return;
      }
      if (e.key === "Enter" && selectedRef.current) {
        e.preventDefault();
        onActivateRef.current(selectedRef.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, camera, size, spinRef]);
  return null;
}

// Background distant stars — a sparse, dim sky so the galaxy's edge stays
// clearly visible against it.
function FarFieldStars() {
  const { positions, colors } = useMemo(() => {
    const count = 1400;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    // Cool blue-white → warm amber, kept dim like a distant sky.
    const tints: [number, number, number][] = [
      [0.58, 0.66, 1.0],
      [0.72, 0.78, 1.0],
      [0.96, 0.96, 1.0],
      [1.0, 0.93, 0.76],
      [1.0, 0.83, 0.55],
      [1.0, 0.68, 0.45],
    ];
    for (let i = 0; i < count; i++) {
      const r = 80 + seededNoise(i,1) * 200;
      const theta = seededNoise(i,2) * Math.PI * 2;
      const phi = Math.acos(2 * seededNoise(i,3) - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const tint =
        tints[Math.floor(seededNoise(i, 4) * tints.length) % tints.length];
      const dim = 0.35 + seededNoise(i, 5) * 0.4;
      col[i * 3] = tint[0] * dim;
      col[i * 3 + 1] = tint[1] * dim;
      col[i * 3 + 2] = tint[2] * dim;
    }
    return { positions: pos, colors: col };
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.24}
        vertexColors
        transparent
        opacity={0.38}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
