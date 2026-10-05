import { ChevronRight, Crosshair, Globe2, Layers, Star } from "lucide-react";
import type { MapFocus } from "./MapView";
import type {
  MapQuadrant,
  MapSector,
  MapStarSystem,
} from "./mapGeometry";

// ---------------------------------------------------------------------------
// MapOverlay — the quadrant navigator HUD (bottom-left). Click a quadrant to
// fly the camera to it, then drill into sectors and star systems. The
// breadcrumb always lets you climb back up.
// ---------------------------------------------------------------------------

interface MapOverlayProps {
  focus: MapFocus;
  quadrants: MapQuadrant[];
  sectors: MapSector[];
  systems: MapStarSystem[];
  onFocusGalaxy: () => void;
  onFocusQuadrant: (id: string) => void;
  onFocusSector: (id: string) => void;
  onSelectSystem: (id: string) => void;
  onOpenEditor?: () => void;
}

export function MapOverlay({
  focus,
  quadrants,
  sectors,
  systems,
  onFocusGalaxy,
  onFocusQuadrant,
  onFocusSector,
  onSelectSystem,
  onOpenEditor,
}: MapOverlayProps) {
  const focusedQuadrant =
    focus.level === "quadrant"
      ? quadrants.find((q) => q.id === focus.quadrantId)
      : focus.level === "sector"
        ? quadrants.find((q) =>
            sectors.some(
              (s) => s.id === focus.sectorId && s.quadrantId === q.id,
            ),
          )
        : undefined;

  const focusedSector =
    focus.level === "sector"
      ? sectors.find((s) => s.id === focus.sectorId)
      : undefined;

  const visibleSectors = focusedQuadrant
    ? sectors.filter((s) => s.quadrantId === focusedQuadrant.id)
    : [];
  const visibleSystems = focusedSector
    ? systems.filter((s) => s.sectorId === focusedSector.id)
    : [];

  return (
    <div className="absolute bottom-4 left-4 z-20 w-72 max-h-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/95 via-slate-900/95 to-gray-900/95 backdrop-blur-xl shadow-2xl shadow-black/50">
      {/* Header + breadcrumb */}
      <div className="px-4 pt-3 pb-2 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">
              Galactic Atlas
            </span>
          </div>
          {onOpenEditor && (
            <button
              onClick={onOpenEditor}
              className="px-2 py-1 rounded-md text-[10px] font-medium bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 hover:bg-cyan-500/20 transition-all"
            >
              Edit Map
            </button>
          )}
        </div>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-[11px] flex-wrap">
          <button
            onClick={onFocusGalaxy}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
              focus.level === "galaxy"
                ? "text-white bg-white/10"
                : "text-white/40 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            <Star className="w-3 h-3" />
            Galaxy
          </button>
          {focusedQuadrant && (
            <>
              <ChevronRight className="w-3 h-3 text-white/20" />
              <button
                onClick={() => onFocusQuadrant(focusedQuadrant.id)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${
                  focus.level === "quadrant"
                    ? "text-white bg-white/10"
                    : "text-white/40 hover:text-white/80 hover:bg-white/5"
                }`}
                style={
                  focus.level === "quadrant"
                    ? { color: focusedQuadrant.color }
                    : undefined
                }
              >
                <Layers className="w-3 h-3" />
                <span className="max-w-[90px] truncate">
                  {focusedQuadrant.name}
                </span>
              </button>
            </>
          )}
          {focusedSector && (
            <>
              <ChevronRight className="w-3 h-3 text-white/20" />
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 max-w-[90px]"
                style={{ color: focusedSector.color }}
              >
                <span className="truncate">{focusedSector.name}</span>
              </span>
            </>
          )}
        </nav>
      </div>

      {/* Body: context-sensitive list */}
      <div className="overflow-y-auto max-h-[calc(100vh-16rem)] p-2 space-y-0.5">
        {/* Galaxy level — quadrants */}
        {focus.level === "galaxy" && (
          <>
            <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/30">
              {quadrants.length} quadrants · click to fly
            </p>
            {quadrants.map((q) => {
              const sectorCount = sectors.filter(
                (s) => s.quadrantId === q.id,
              ).length;
              return (
                <button
                  key={q.id}
                  onClick={() => onFocusQuadrant(q.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-all text-left group"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10"
                    style={{ backgroundColor: q.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                      {q.name}
                    </p>
                    <p className="text-[10px] text-white/30 truncate">
                      {q.description || `${sectorCount} sectors`}
                    </p>
                  </div>
                  <span className="text-[10px] text-white/25 shrink-0">
                    {sectorCount} sec
                  </span>
                </button>
              );
            })}
            {quadrants.length === 0 && (
              <p className="p-4 text-center text-xs text-white/30">
                No quadrants yet — open the editor to build your map.
              </p>
            )}
          </>
        )}

        {/* Quadrant level — sectors */}
        {focus.level === "quadrant" && (
          <>
            <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/30">
              {visibleSectors.length} sectors · click to zoom
            </p>
            {visibleSectors.map((s) => (
              <button
                key={s.id}
                onClick={() => onFocusSector(s.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-all text-left group"
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0 ring-1 ring-white/10"
                  style={{ backgroundColor: s.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                    {s.name}
                  </p>
                  <p className="text-[10px] text-white/30 truncate">
                    {s.description || "Click to inspect star systems"}
                  </p>
                </div>
                <span className="text-[10px] text-white/25 shrink-0">
                  {systems.filter((sy) => sy.sectorId === s.id).length} sys
                </span>
              </button>
            ))}
            {visibleSectors.length === 0 && (
              <p className="p-4 text-center text-xs text-white/30">
                No sectors in this quadrant yet.
              </p>
            )}
          </>
        )}

        {/* Sector level — star systems */}
        {focus.level === "sector" && (
          <>
            <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-white/30">
              {visibleSystems.length} star systems
            </p>
            {visibleSystems.map((sys) => (
              <button
                key={sys.id}
                onClick={() => onSelectSystem(sys.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.05] transition-all text-left group"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: sys.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white/80 truncate group-hover:text-white transition-colors">
                    {sys.name}
                  </p>
                  {sys.description && (
                    <p className="text-[10px] text-white/30 truncate">
                      {sys.description}
                    </p>
                  )}
                </div>
              </button>
            ))}
            {visibleSystems.length === 0 && (
              <p className="p-4 text-center text-xs text-white/30">
                No star systems in this sector yet.
              </p>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex items-center gap-1.5">
        <Crosshair className="w-3 h-3 text-cyan-400/50" />
        <span className="text-[10px] text-white/30">
          ↑↓ or right-drag to zoom · drag to orbit
        </span>
      </div>
    </div>
  );
}
