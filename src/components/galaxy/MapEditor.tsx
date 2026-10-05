import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Globe2,
  Layers,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import type {
  MapQuadrant,
  MapSector,
  MapStarSystem,
} from "./mapGeometry";
import { MapEntityDialog } from "./MapEntityDialog";
import type { MapEntityDraft, MapEntityKind } from "./MapEntityDialog";

// ---------------------------------------------------------------------------
// MapEditor — manage the galactic atlas: create, edit, and delete quadrants,
// sectors, and star systems through an expandable tree. Deletion cascades
// server-side, and the dialog warns before confirming.
// ---------------------------------------------------------------------------

interface MapEditorProps {
  quadrants: MapQuadrant[];
  sectors: MapSector[];
  systems: MapStarSystem[];
  onCreate: (
    kind: MapEntityKind,
    parentId: string | null,
    draft: MapEntityDraft,
  ) => Promise<void> | void;
  onUpdate: (
    kind: MapEntityKind,
    id: string,
    draft: MapEntityDraft,
  ) => Promise<void> | void;
  onDelete: (kind: MapEntityKind, id: string) => Promise<void> | void;
  onClose: () => void;
}

interface DialogState {
  kind: MapEntityKind;
  /** null → create mode */
  entityId: string | null;
  /** parent for create mode (quadrantId / sectorId / null for root) */
  parentId: string | null;
}

export function MapEditor({
  quadrants,
  sectors,
  systems,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: MapEditorProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const findEntity = (
    kind: MapEntityKind,
    id: string,
  ): { name: string; description: string; color: string } | null => {
    const list =
      kind === "quadrant"
        ? quadrants
        : kind === "sector"
          ? sectors
          : systems;
    const found = list.find((e) => e.id === id);
    return found
      ? {
          name: found.name,
          description: found.description,
          color: found.color,
        }
      : null;
  };

  const parentLabelOf = (kind: MapEntityKind, parentId: string | null) => {
    // Create mode: the parent is given directly.
    if (parentId) {
      if (kind === "sector") {
        return quadrants.find((q) => q.id === parentId)?.name;
      }
      if (kind === "system") {
        return sectors.find((s) => s.id === parentId)?.name;
      }
      return undefined;
    }
    // Edit mode: resolve the entity's actual parent so the dialog doesn't
    // claim a system lives at the "top level" of the atlas.
    if (kind === "system" && dialog?.entityId) {
      const sys = systems.find((s) => s.id === dialog.entityId);
      if (sys) return sectors.find((s) => s.id === sys.sectorId)?.name;
    } else if (kind === "sector" && dialog?.entityId) {
      const sec = sectors.find((s) => s.id === dialog.entityId);
      if (sec) return quadrants.find((q) => q.id === sec.quadrantId)?.name;
    }
    return undefined;
  };

  const dialogEntity =
    dialog && dialog.entityId !== null
      ? findEntity(dialog.kind, dialog.entityId)
      : null;

  const handleDialogSave = async (draft: MapEntityDraft) => {
    if (!dialog) return;
    if (dialog.entityId !== null) {
      await onUpdate(dialog.kind, dialog.entityId, draft);
    } else {
      await onCreate(dialog.kind, dialog.parentId, draft);
    }
    setDialog(null);
  };

  const handleDialogDelete = async () => {
    if (!dialog || dialog.entityId === null) return;
    await onDelete(dialog.kind, dialog.entityId);
    setDialog(null);
  };

  const rowClass =
    "w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.05] transition-all text-left group";
  const iconBtn =
    "p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-all";

  return (
    <div className="absolute top-4 left-4 z-20 w-80 max-h-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900/95 via-slate-900/95 to-gray-900/95 backdrop-blur-xl shadow-2xl shadow-black/50 flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">Map Editor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setDialog({ kind: "quadrant", entityId: null, parentId: null })
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 hover:bg-cyan-500/20 transition-all"
          >
            <Plus className="w-3 h-3" />
            Quadrant
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="overflow-y-auto p-2 space-y-0.5 flex-1">
        {quadrants.length === 0 && (
          <p className="p-4 text-center text-xs text-white/30">
            No quadrants yet. Create your first quadrant to start mapping the
            galaxy.
          </p>
        )}

        {quadrants.map((quad) => {
          const qExpanded = expanded.has(quad.id);
          const quadSectors = sectors
            .filter((s) => s.quadrantId === quad.id)
            .sort((a, b) => a.order - b.order);
          return (
            <div key={quad.id}>
              {/* Quadrant row */}
              <div className={rowClass}>
                <button
                  onClick={() => toggle(quad.id)}
                  className="p-0.5 rounded hover:bg-white/10 transition-all"
                  aria-label="Toggle"
                >
                  {qExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                  )}
                </button>
                <Globe2
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: quad.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white/85 truncate">
                    {quad.name}
                  </p>
                  <p className="text-[10px] text-white/30 truncate">
                    {quadSectors.length} sectors ·{" "}
                    {systems.filter((sy) =>
                      quadSectors.some((cs) => cs.id === sy.sectorId),
                    ).length}{" "}
                    systems
                  </p>
                </div>
                <button
                  onClick={() =>
                    setDialog({
                      kind: "sector",
                      entityId: null,
                      parentId: quad.id,
                    })
                  }
                  className={iconBtn}
                  title="Add sector"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() =>
                    setDialog({
                      kind: "quadrant",
                      entityId: quad.id,
                      parentId: null,
                    })
                  }
                  className={iconBtn}
                  title="Edit quadrant"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sectors */}
              {qExpanded &&
                quadSectors.map((sec) => {
                  const sExpanded = expanded.has(sec.id);
                  const secSystems = systems
                    .filter((sy) => sy.sectorId === sec.id)
                    .sort((a, b) => a.order - b.order);
                  return (
                    <div key={sec.id} className="ml-4 border-l border-white/5">
                      <div className={rowClass}>
                        <button
                          onClick={() => toggle(sec.id)}
                          className="p-0.5 rounded hover:bg-white/10 transition-all"
                          aria-label="Toggle"
                        >
                          {sExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-white/40" />
                          )}
                        </button>
                        <Layers
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: sec.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white/75 truncate">
                            {sec.name}
                          </p>
                          <p className="text-[10px] text-white/30 truncate">
                            {secSystems.length} systems
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setDialog({
                              kind: "system",
                              entityId: null,
                              parentId: sec.id,
                            })
                          }
                          className={iconBtn}
                          title="Add star system"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDialog({
                              kind: "sector",
                              entityId: sec.id,
                              parentId: null,
                            })
                          }
                          className={iconBtn}
                          title="Edit sector"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Star systems */}
                      {sExpanded &&
                        secSystems.map((sys) => (
                          <div
                            key={sys.id}
                            className="ml-4 border-l border-white/5"
                          >
                            <div className={rowClass}>
                              <span className="w-2 h-2 rounded-full shrink-0 ml-1.5" style={{ backgroundColor: sys.color }} />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-white/70 truncate">
                                  {sys.name}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  setDialog({
                                    kind: "system",
                                    entityId: sys.id,
                                    parentId: null,
                                  })
                                }
                                className={iconBtn}
                                title="Edit star system"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>

      {/* Stats footer */}
      <div className="px-4 py-2 border-t border-white/5 bg-white/[0.02] flex items-center justify-between text-[10px] text-white/30 flex-shrink-0">
        <span>{quadrants.length} quadrants</span>
        <span>{sectors.length} sectors</span>
        <span>{systems.length} systems</span>
      </div>

      {/* Create / edit dialog */}
      {dialog && (
        <MapEntityDialog
          key={`${dialog.kind}:${dialog.entityId ?? "new"}`}
          kind={dialog.kind}
          entity={dialogEntity}
          parentLabel={parentLabelOf(dialog.kind, dialog.parentId)}
          isOpen={true}
          onSave={handleDialogSave}
          onDelete={dialog.entityId !== null ? handleDialogDelete : undefined}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
