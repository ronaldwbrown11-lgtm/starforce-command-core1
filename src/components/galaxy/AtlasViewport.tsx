import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { GalaxyCanvas, type MapEntityCrud } from "./GalaxyCanvas";
import { AtlasControlsBar } from "./AtlasControlsBar";
import type { SavedWarpLane, WarpCrud } from "./WarpLaneEditor";
import type {
  MapQuadrant,
  MapSector,
  MapStarSystem,
  WarpGateNode,
} from "./mapGeometry";
import type { MapEntityDraft, MapEntityKind } from "./MapEntityDialog";
import type { StarData, StarCategory } from "./galaxyData";

// ---------------------------------------------------------------------------
// AtlasViewport — the native 3D galaxy view, wired into this site's shared
// canon atlas.
//
// Atlas behavior:
//   - Reads are SHARED: one canon atlas for every visitor (signed-out too).
//   - Writes are operator-gated server-side; for everyone else the viewport
//     renders read-only (creation tools and save buttons hidden).
//   - The starter-map seed only runs when the atlas is empty. The star /
//     sector-star seeds are intentionally NOT run here: their tombstones live
//     on the source project's users table, so re-running them on this
//     deployment would duplicate the transferred reference stars.
// ---------------------------------------------------------------------------

const ATLAS_EDIT_CAPS = [
  "operator",
  "senior_operator",
  "story_editor",
  "lore_archivist",
];

type AtlasPreview = {
  position: [number, number, number];
  name: string;
  color: string;
} | null;

// Map window stretch limits. The default size is responsive (h-[90vh] plus the
// page's min-h floor); dragging the bottom edge pins an explicit pixel height.
const ATLAS_MIN_H = 480;
const ATLAS_STEP_H = 48;
const ATLAS_HEIGHT_KEY = "sf-atlas-window-height";

// The draggable ceiling deliberately runs past the viewport: the map window is
// allowed to grow taller than the screen (the page simply scrolls), so pulling
// the bottom edge down always has room to move. Clamping to `innerHeight` left
// the default `90vh` window already at its maximum on most screens, which is
// why the handle felt locked.
const atlasMaxHeight = () =>
  Math.max(ATLAS_MIN_H + ATLAS_STEP_H, Math.round(window.innerHeight * 1.6));

type AtlasViewportProps = {
  className?: string;
  builderPlacementMode?: boolean;
  builderPreview?: AtlasPreview;
  onBuilderPlace?: (position: [number, number, number], sectorId: string) => void;
  onCancelBuilderPlacement?: () => void;
};

export type AtlasBuilderPin = { position: [number, number, number]; sectorId: string };
export type AtlasBuilderPreview = { position: [number, number, number]; name: string; color: string };

export default function AtlasViewport({
  className = "",
  builderPlacementMode = false,
  builderPreview = null,
  onBuilderPlace,
  onCancelBuilderPlacement,
}: AtlasViewportProps) {
  const { user } = useAuth();
  const canEdit =
    !!user &&
    (user.role === "admin" ||
      ATLAS_EDIT_CAPS.includes(String(user.opRole ?? "")));

  // ---- Map window height ---------------------------------------------------
  // The window is responsive by default (h-[90vh] + a min-h floor from the
  // page), and its bottom edge is draggable so it can be stretched as far as
  // the screen allows. A dragged height is remembered per browser; resetting
  // (double-click) returns the window to its responsive size.
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const [stretching, setStretching] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const applyHeight = useCallback((px: number) => {
    // Never a sliver; the ceiling is generous so the window can grow past the
    // viewport instead of snapping back and feeling locked.
    const next = Math.min(Math.max(Math.round(px), ATLAS_MIN_H), atlasMaxHeight());
    setCustomHeight(next);
    try {
      window.localStorage.setItem(ATLAS_HEIGHT_KEY, String(next));
    } catch {
      /* storage unavailable — the height still applies for this visit */
    }
  }, []);

  const currentHeight = useCallback(
    () =>
      customHeight ??
      Math.round(frameRef.current?.getBoundingClientRect().height ?? ATLAS_MIN_H),
    [customHeight],
  );

  // Restore a previously dragged height.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ATLAS_HEIGHT_KEY);
      const n = raw ? Number.parseInt(raw, 10) : Number.NaN;
      if (Number.isFinite(n) && n >= ATLAS_MIN_H)
        setCustomHeight(Math.min(n, atlasMaxHeight()));
    } catch {
      /* stay responsive */
    }
  }, []);

  // Keep a dragged height inside the window when the browser is resized.
  useEffect(() => {
    if (customHeight === null) return;
    const onResize = () => applyHeight(customHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [customHeight, applyHeight]);

  const resetHeight = useCallback(() => {
    setCustomHeight(null);
    try {
      window.localStorage.removeItem(ATLAS_HEIGHT_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    const frame = frameRef.current;
    if (!frame) return;
    const startY = e.clientY;
    const startH = currentHeight();
    const maxH = atlasMaxHeight();
    let latest = startH;
    let moved = false;
    setStretching(true);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nicety, not a requirement */
    }
    // Resize the frame straight on the DOM node while the pointer moves. This
    // deliberately avoids React state: the enclosing tree holds the whole 3D
    // scene, and a state update per pointermove would re-render it on every
    // drag frame. The canvas still resizes live (ResizeObserver), and the
    // height is committed + persisted once, on release.
    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      if (!moved && Math.abs(dy) < 3) return; // a click must not pin the window
      moved = true;
      latest = Math.min(Math.max(Math.round(startH + dy), ATLAS_MIN_H), maxH);
      frame.style.height = `${latest}px`;
      frame.style.minHeight = `${latest}px`;
    };
    // Listen on the window, not the handle: the handle is only a few pixels
    // tall, so if pointer capture is dropped (or the pointer drifts off it) the
    // drag would die instantly. Window-level listeners keep tracking instead.
    const onDone = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onDone);
      window.removeEventListener("pointercancel", onDone);
      setStretching(false);
      if (moved) applyHeight(latest);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onDone);
    window.addEventListener("pointercancel", onDone);
  };

  // Keyboard equivalent: focus the handle, then ArrowDown stretches the map
  // and ArrowUp pulls the bottom edge back up.
  const onHandleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    applyHeight(currentHeight() + (e.key === "ArrowDown" ? ATLAS_STEP_H : -ATLAS_STEP_H));
  };

  // ---- Star lore ----------------------------------------------------------
  const savedLore = useQuery(api.starLore.list);
  const saveStarName = useMutation(api.starLore.setStarName);
  const deleteStarName = useMutation(api.starLore.resetStarName);

  // ---- Warp lanes ---------------------------------------------------------
  const savedLanes = useQuery(api.galaxyLanes.list);
  const saveLane = useMutation(api.galaxyLanes.save);
  const deleteLane = useMutation(api.galaxyLanes.remove);
  const warpLanes: SavedWarpLane[] = savedLanes ?? [];
  const warpCrud: WarpCrud = {
    save: async (draft) => {
      await saveLane({ ...draft, id: draft.id as Id<"galaxyLanes"> | undefined });
    },
    remove: async (id) => {
      await deleteLane({ id: id as Id<"galaxyLanes"> });
    },
  };

  const { starNames, loreNotes, starCategories, savedStars } = useMemo(() => {
    const names: Record<string, string> = {};
    const notes: Record<string, string> = {};
    const categories: Record<string, StarCategory> = {};
    const stars: StarData[] = [];
    for (const lore of savedLore ?? []) {
      names[lore.starId] = lore.name;
      if (lore.loreNotes) notes[lore.starId] = lore.loreNotes;
      if (lore.category) categories[lore.starId] = lore.category;
      // Legacy random stars stay where their lore was saved; HYG catalog data
      // takes precedence for reference stars and cannot be repositioned here.
      if (!lore.starId.startsWith("hyg-"))
        stars.push({
          id: lore.starId,
          name: lore.name,
          defaultName: lore.defaultName,
          position: lore.position,
          color: lore.color,
          size: lore.size,
          temperature: lore.temperature,
          magnitude: lore.magnitude,
          isCustom: lore.isCustom,
        });
    }
    return {
      starNames: names,
      loreNotes: notes,
      starCategories: categories,
      savedStars: stars,
    };
  }, [savedLore]);

  // ---- Galactic atlas (quadrants → sectors → star systems) ---------------
  const atlas = useQuery(api.galaxyMap.list);
  const seedAtlas = useMutation(api.galaxyMap.seed);
  const createQuadrant = useMutation(api.galaxyMap.createQuadrant);
  const updateQuadrant = useMutation(api.galaxyMap.updateQuadrant);
  const deleteQuadrant = useMutation(api.galaxyMap.deleteQuadrant);
  const createSector = useMutation(api.galaxyMap.createSector);
  const updateSector = useMutation(api.galaxyMap.updateSector);
  const deleteSector = useMutation(api.galaxyMap.deleteSector);
  const createSystem = useMutation(api.galaxyMap.createSystem);
  const updateSystem = useMutation(api.galaxyMap.updateSystem);
  const deleteSystem = useMutation(api.galaxyMap.deleteSystem);

  // ---- Warp gate nodes ----------------------------------------------------
  const warpGates = useQuery(api.galaxyGates.list);
  const createWarpGate = useMutation(api.galaxyGates.create);
  const updateWarpGate = useMutation(api.galaxyGates.update);
  const removeWarpGate = useMutation(api.galaxyGates.remove);

  // Seed the starter Milky Way atlas only if the canon chart is empty
  // (server is idempotent; the ref avoids hammering it every render).
  const seededRef = useRef(false);
  useEffect(() => {
    if (!canEdit || !atlas || seededRef.current) return;
    seededRef.current = true;
    // `seeded` ignores console-mirrored sectors, so a published console desk
    // never suppresses the starter Milky Way atlas.
    if (!atlas.seeded) {
      seedAtlas().catch((err) =>
        console.error("Failed to seed galaxy map:", err),
      );
    }
  }, [canEdit, atlas, seedAtlas]);

  const mapQuadrants: MapQuadrant[] = atlas?.quadrants ?? [];
  const mapSectors: MapSector[] = atlas?.sectors ?? [];
  const mapSystems: MapStarSystem[] = atlas?.systems ?? [];
  // Warp gate nodes in map-shape (Convex returns `pos`, the canvas wants
  // `position` like every other map entity).
  const gateNodes: WarpGateNode[] = (warpGates ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    color: g.color,
    level: g.level,
    quadrantId: g.quadrantId,
    sectorId: g.sectorId,
    systemId: g.systemId,
    position: g.pos,
  }));

  const mapCrud: MapEntityCrud = {
    create: useCallback(
      async (
        kind: MapEntityKind,
        parentId: string | null,
        draft: MapEntityDraft,
      ) => {
        try {
          const args = {
            name: draft.name,
            description: draft.description || undefined,
            color: draft.color,
          };
          if (kind === "quadrant") {
            await createQuadrant(args);
          } else if (kind === "sector") {
            if (!parentId) throw new Error("Sector needs a parent quadrant");
            await createSector({
              quadrantId: parentId as Id<"quadrants">,
              ...args,
              posX: draft.position?.[0],
              posY: draft.position?.[1],
              posZ: draft.position?.[2],
            });
          } else if (kind === "gate") {
            if (!parentId) throw new Error("Warp gate needs a parent entity");
            if (!draft.position) throw new Error("Warp gate needs a map position");
            if (!draft.gateLevel) throw new Error("Warp gate needs a level");
            await createWarpGate({
              level: draft.gateLevel,
              quadrantId:
                draft.gateLevel === "galaxy" || draft.gateLevel === "quadrant"
                  ? (parentId as Id<"quadrants">)
                  : undefined,
              sectorId:
                draft.gateLevel === "sector"
                  ? (parentId as Id<"sectors">)
                  : undefined,
              systemId:
                draft.gateLevel === "system"
                  ? (parentId as Id<"starSystems">)
                  : undefined,
              ...args,
              posX: draft.position[0],
              posY: draft.position[1],
              posZ: draft.position[2],
            });
          } else {
            if (!parentId) throw new Error("System needs a parent sector");
            await createSystem({
              sectorId: parentId as Id<"sectors">,
              ...args,
              posX: draft.position?.[0],
              posY: draft.position?.[1],
              posZ: draft.position?.[2],
              starId: draft.starId,
            });
          }
        } catch (err) {
          console.error("Failed to create map entity:", err);
          throw err;
        }
      },
      [createQuadrant, createSector, createSystem, createWarpGate],
    ),
    update: useCallback(
      async (kind: MapEntityKind, id: string, draft: MapEntityDraft) => {
        try {
          const args = {
            name: draft.name,
            description: draft.description || undefined,
            color: draft.color,
          };
          if (kind === "quadrant") {
            await updateQuadrant({ id: id as Id<"quadrants">, ...args });
          } else if (kind === "sector") {
            await updateSector({
              id: id as Id<"sectors">,
              ...args,
              posX: draft.position?.[0],
              posY: draft.position?.[1],
              posZ: draft.position?.[2],
            });
          } else if (kind === "gate") {
            await updateWarpGate({ id: id as Id<"galaxyGates">, ...args });
          } else {
            await updateSystem({
              id: id as Id<"starSystems">,
              ...args,
              posX: draft.position?.[0],
              posY: draft.position?.[1],
              posZ: draft.position?.[2],
            });
          }
        } catch (err) {
          console.error("Failed to update map entity:", err);
          throw err;
        }
      },
      [updateQuadrant, updateSector, updateSystem, updateWarpGate],
    ),
    remove: useCallback(
      async (kind: MapEntityKind, id: string) => {
        try {
          if (kind === "quadrant") {
            await deleteQuadrant({ id: id as Id<"quadrants"> });
          } else if (kind === "sector") {
            await deleteSector({ id: id as Id<"sectors"> });
          } else if (kind === "gate") {
            await removeWarpGate({ id: id as Id<"galaxyGates"> });
          } else {
            await deleteSystem({ id: id as Id<"starSystems"> });
          }
        } catch (err) {
          console.error("Failed to delete map entity:", err);
          throw err;
        }
      },
      [deleteQuadrant, deleteSector, deleteSystem, removeWarpGate],
    ),
  };

  // Persist star name & category to Convex
  const handleSetStarName = useCallback(
    async (
      starId: string,
      name: string,
      star: StarData,
      category: StarCategory,
      notes: string,
    ) => {
      await saveStarName({
        starId,
        name,
        defaultName: star.defaultName,
        posX: star.position[0],
        posY: star.position[1],
        posZ: star.position[2],
        color: star.color,
        size: star.size,
        temperature: star.temperature,
        magnitude: star.magnitude,
        loreNotes: notes,
        isCustom: star.isCustom,
        category: category === "none" ? undefined : category,
      });
    },
    [saveStarName],
  );

  const handleResetStarName = useCallback(
    async (starId: string) => {
      await deleteStarName({ starId });
    },
    [deleteStarName],
  );

  const customNameCount = Object.keys(starNames).length;
  const loreCount = Object.keys(loreNotes).length;
  const chartStars = useMemo(() => {
    if (!builderPreview) return savedStars;
    return [
      ...savedStars,
      {
        id: "builder-preview",
        name: builderPreview.name || "Proposed discovery",
        defaultName: builderPreview.name || "Proposed discovery",
        position: builderPreview.position,
        color: builderPreview.color,
        size: 1.4,
        temperature: 5800,
        magnitude: 1,
        isCustom: true,
      },
    ];
  }, [savedStars, builderPreview]);

  return (
    <div
      ref={frameRef}
      className={`flex flex-col ${className}`}
      style={
        customHeight === null
          ? undefined
          : { height: customHeight, minHeight: customHeight }
      }
    >
      {/* Console strip — live atlas stats */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-b border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
        <span className="uf-eyebrow mr-auto">Star Atlas // galactic atlas</span>
        <span className="font-mono text-[11px] text-uf-muted">
          {mapQuadrants.length} quad · {mapSectors.length} sec ·{" "}
          {mapSystems.length} sys
        </span>
        {customNameCount > 0 && (
          <span className="font-mono text-[11px] text-amber-200/70">
            ★ {customNameCount} named
          </span>
        )}
        {loreCount > 0 && (
          <span className="font-mono text-[11px] text-amber-200/70">
            ✦ {loreCount} with lore
          </span>
        )}
        <span className="hidden md:inline font-mono text-[11px] text-uf-muted">
          {canEdit ? "canon write access" : "view only"}
        </span>
      </div>

      {/* The galaxy */}
      <div className="relative flex-1 min-h-0">
        <GalaxyCanvas
          prominentStars={chartStars}
          warpLanes={warpLanes}
          warpCrud={warpCrud}
          starNames={starNames}
          onSetStarName={handleSetStarName}
          onResetStarName={handleResetStarName}
          loreNotes={loreNotes}
          starCategories={starCategories}
          mapQuadrants={mapQuadrants}
          mapSectors={mapSectors}
          mapSystems={mapSystems}
          warpGates={gateNodes}
          mapCrud={mapCrud}
          readOnly={!canEdit}
          builderPlacementMode={builderPlacementMode}
          onBuilderPlace={onBuilderPlace}
          onCancelBuilderPlacement={onCancelBuilderPlacement}
        />
      </div>

      {/* Stretch handle — drag the bottom edge down for a taller map window. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Stretch the map window"
        aria-valuemin={ATLAS_MIN_H}
        aria-valuemax={atlasMaxHeight()}
        aria-valuenow={customHeight ?? undefined}
        tabIndex={0}
        title="Drag down to stretch the map window · double-click to reset"
        onPointerDown={onHandlePointerDown}
        onKeyDown={onHandleKeyDown}
        onDoubleClick={resetHeight}
        className={`group flex h-5 shrink-0 cursor-ns-resize touch-none select-none items-center justify-center gap-2 border-t border-[color:var(--uf-border)] outline-none transition-colors hover:bg-[rgba(0,229,255,0.10)] focus-visible:bg-[rgba(0,229,255,0.10)] ${
          stretching ? "bg-[rgba(0,229,255,0.14)]" : "bg-[rgba(5,8,22,0.65)]"
        }`}
      >
        <span
          aria-hidden
          className="h-1 w-10 rounded-full bg-white/25 transition-colors group-hover:bg-[rgba(0,229,255,0.8)] group-focus-visible:bg-[rgba(0,229,255,0.8)]"
        />
        <span className="text-[10px] uppercase tracking-[0.14em] text-white/40 transition-colors group-hover:text-uf-cyan group-focus-visible:text-uf-cyan">
          drag to stretch
        </span>
        <span
          aria-hidden
          className="h-1 w-10 rounded-full bg-white/25 transition-colors group-hover:bg-[rgba(0,229,255,0.8)] group-focus-visible:bg-[rgba(0,229,255,0.8)]"
        />
      </div>

      {/* Keyboard + mouse legend — rendered UNDER the 3D window, not over it. */}
      <AtlasControlsBar />
    </div>
  );
}
