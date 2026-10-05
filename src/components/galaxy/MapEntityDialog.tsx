import { useEffect, useRef, useState } from "react";
import { Trash2, Save, X, Globe2, Layers, Star, Rocket } from "lucide-react";

// ---------------------------------------------------------------------------
// MapEntityDialog — create or edit a quadrant / sector / star system / warp
// gate. Delete is available in edit mode (cascades handled server-side).
// ---------------------------------------------------------------------------

export type MapEntityKind = "quadrant" | "sector" | "system" | "gate";

export interface MapEntityDraft {
  name: string;
  description: string;
  color: string;
  /** Explicit map placement (e.g. a sector created by clicking the map). */
  position?: [number, number, number];
  /** Lore-list star this entity stands for (auto-seeded star systems). */
  starId?: string;
  /** For warp-gate drafts: which level the gate belongs to. */
  gateLevel?: import("./mapGeometry").WarpGateLevel;
}

interface MapEntityDialogProps {
  kind: MapEntityKind;
  /** null → create mode */
  entity: MapEntityDraft | null;
  parentLabel?: string;
  isOpen: boolean;
  /** Create-mode starting values (e.g. a hub named after its quadrant). */
  defaultName?: string;
  defaultColor?: string;
  readOnly?: boolean;
  onSave: (draft: MapEntityDraft) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  "#38bdf8",
  "#4ade80",
  "#facc15",
  "#f87171",
  "#a78bfa",
  "#f472b6",
  "#2dd4bf",
  "#fb923c",
  "#e2e8f0",
  "#94a3b8",
];

const KIND_META: Record<
  MapEntityKind,
  { label: string; icon: typeof Globe2; noun: string }
> = {
  quadrant: { label: "Quadrant", icon: Globe2, noun: "quadrant" },
  sector: { label: "Sector", icon: Layers, noun: "sector" },
  system: { label: "Star System", icon: Star, noun: "star system" },
  gate: { label: "Warp Gate", icon: Rocket, noun: "warp gate" },
};

export function MapEntityDialog({
  kind,
  entity,
  parentLabel,
  isOpen,
  defaultName,
  defaultColor,
  readOnly = false,
  onSave,
  onDelete,
  onClose,
}: MapEntityDialogProps) {
  const isEdit = entity !== null;
  const meta = KIND_META[kind];

  const [name, setName] = useState(entity?.name ?? defaultName ?? "");
  const [description, setDescription] = useState(entity?.description ?? "");
  const [color, setColor] = useState(
    entity?.color ?? defaultColor ?? PRESET_COLORS[0],
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Form state initializes from the target entity at mount; callers key this
  // dialog by target so switching entities remounts with fresh values.
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    if (!name.trim()) return;
    onSave({ name: name.trim(), description: description.trim(), color });
  };

  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 shadow-2xl shadow-black/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center border"
                style={{
                  backgroundColor: `${color}20`,
                  borderColor: `${color}40`,
                }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  {isEdit ? `Edit ${meta.label}` : `New ${meta.label}`}
                </h3>
                <p className="text-xs text-white/50">
                  {parentLabel
                    ? `Inside ${parentLabel}`
                    : "Top level of the galactic atlas"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                Name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`Name this ${meta.noun}...`}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm
                  placeholder:text-white/20 focus:outline-none focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 transition-all"
              />
            </div>

            {/* Description / lore */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                Lore Notes
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  kind === "system"
                    ? "The story of this star system..."
                    : `Describe this ${meta.noun}...`
                }
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-sm
                  placeholder:text-white/20 focus:outline-none focus:border-cyan-400/40 focus:ring-1 focus:ring-cyan-400/20 transition-all resize-none"
              />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/50 uppercase tracking-wider">
                Color
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full transition-all ${
                      color === c
                        ? "ring-2 ring-offset-2 ring-offset-gray-900 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: c, "--tw-ring-color": c } as React.CSSProperties}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            {readOnly ? (
              <p className="text-center text-xs text-white/50">
                View only — the canon chart is maintained by fleet operators.
              </p>
            ) : (
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={!name.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                  bg-gradient-to-r from-cyan-500 to-sky-500 hover:from-cyan-400 hover:to-sky-400
                  text-black font-medium text-sm transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {isEdit ? "Save Changes" : `Create ${meta.label}`}
              </button>

              {isEdit && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDelete) {
                      onDelete();
                    } else {
                      setConfirmDelete(true);
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all border ${
                    confirmDelete
                      ? "bg-red-500/20 border-red-400/50 text-red-300"
                      : "bg-white/[0.05] hover:bg-white/[0.08] border-white/10 text-white/60 hover:text-white/80"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {confirmDelete ? "Confirm?" : "Delete"}
                </button>
              )}
            </div>
            )}

            {confirmDelete && (
              <p className="text-[11px] text-red-300/70 text-center">
                Deleting removes everything nested inside it. Click Confirm.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
