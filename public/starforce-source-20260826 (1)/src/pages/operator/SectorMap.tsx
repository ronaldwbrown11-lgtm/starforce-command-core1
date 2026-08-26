import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { GalaxyMapMini } from "@/components/widgets/GalaxyMapMini";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Loader2, Map as MapIcon, Pencil, Plus, Trash2, X } from "lucide-react";

type SectorDoc = {
  _id: Id<"sectorMap">;
  name: string;
  slug: string;
  description?: string;
  loreCount?: number;
  x: number;
  y: number;
};

type FormState = {
  id?: Id<"sectorMap">;
  name: string;
  slug: string;
  description: string;
  loreCount: string;
  x: string;
  y: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  description: "",
  loreCount: "",
  x: "200",
  y: "150",
};

export default function OperatorSectorMap() {
  const sectors = useQuery(api.sectorMap.listSectorsForOperator);
  const upsert = useMutation(api.sectorMap.upsertSector);
  const remove = useMutation(api.sectorMap.deleteSector);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);

  function startEdit(s?: SectorDoc) {
    setEditing(
      s
        ? {
            id: s._id,
            name: s.name,
            slug: s.slug,
            description: s.description ?? "",
            loreCount: s.loreCount != null ? String(s.loreCount) : "",
            x: String(s.x),
            y: String(s.y),
          }
        : EMPTY_FORM,
    );
  }

  async function save() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return toast.error("Sector name is required.");
    const x = Number(editing.x);
    const y = Number(editing.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return toast.error("X and Y must be numbers (SVG coordinates).");
    }
    const loreCount = editing.loreCount.trim()
      ? Math.max(0, Math.round(Number(editing.loreCount)))
      : undefined;
    if (editing.loreCount.trim() && (loreCount == null || !Number.isFinite(loreCount))) {
      return toast.error("Lore count must be a number.");
    }
    setBusy(true);
    try {
      await upsert({
        id: editing.id,
        name,
        slug: editing.slug.trim() || undefined,
        description: editing.description.trim() || undefined,
        loreCount,
        x,
        y,
      });
      toast.success(editing.id ? "Sector updated." : "Sector added.");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(s: SectorDoc) {
    if (!window.confirm(`Delete sector "${s.name}" from the map?`)) return;
    try {
      await remove({ id: s._id });
      toast.success("Sector removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <MapIcon className="h-6 w-6 text-uf-cyan" aria-hidden />
          Sector Map
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Manage the sectors rendered on the public galaxy map. Each sector
          has an (x, y) position in the map's SVG viewBox and a lore count
          for node sizing. Clicking a node filters the lore archive by the
          sector's name, which matches the entries' sector field.
        </p>
      </header>

      <section aria-label="Live map preview" className="mb-6">
        <GalaxyMapMini />
      </section>

      <section aria-label="Sector management">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-semibold">
            Sectors <span className="text-uf-muted text-sm">({sectors?.length ?? "…"})</span>
          </h2>
          <NeonButton variant="primary" onClick={() => startEdit()}>
            <Plus className="h-4 w-4" aria-hidden />
            New sector
          </NeonButton>
        </header>

        {editing ? (
          <HoloCard className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">
                {editing.id ? `Edit ${editing.name}` : "Add sector"}
              </h3>
              <button
                type="button"
                aria-label="Close editor"
                className="uf-btn uf-btn--ghost"
                onClick={() => setEditing(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" value={editing.name} onChange={(v) => setEditing((f) => f && { ...f, name: v })} placeholder="Terran Reach" />
              <Field
                label="Slug (identifier)"
                value={editing.slug}
                onChange={(v) => setEditing((f) => f && { ...f, slug: v })}
                placeholder="terran-reach"
                disabled={!!editing.id}
              />
              <Field label="X coordinate" value={editing.x} onChange={(v) => setEditing((f) => f && { ...f, x: v })} placeholder="200" />
              <Field label="Y coordinate" value={editing.y} onChange={(v) => setEditing((f) => f && { ...f, y: v })} placeholder="150" />
              <Field label="Lore count" value={editing.loreCount} onChange={(v) => setEditing((f) => f && { ...f, loreCount: v })} placeholder="12" />
              <Field label="Description (optional)" value={editing.description} onChange={(v) => setEditing((f) => f && { ...f, description: v })} placeholder="Short survey note" />
            </div>
            {editing.id ? (
              <p className="text-uf-muted text-xs mt-3">
                The slug is fixed for existing sectors. Renaming a sector
                updates what the map node filters in the lore archive.
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <NeonButton variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </NeonButton>
              <NeonButton variant="primary" onClick={save} loading={busy} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {editing.id ? "Save changes" : "Add sector"}
              </NeonButton>
            </div>
          </HoloCard>
        ) : null}

        <HoloCard>
          {sectors === undefined ? (
            <div className="uf-skeleton" style={{ height: 160 }} />
          ) : sectors.length === 0 ? (
            <p className="uf-empty">No sectors on the map yet. Add your first one.</p>
          ) : (
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {sectors.map((s) => (
                <li
                  key={s._id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold truncate">{s.name}</p>
                    <p className="text-uf-muted text-xs flex flex-wrap gap-2 mt-1">
                      <StatusPill variant="info">{s.slug}</StatusPill>
                      <span className="font-mono">x:{s.x} y:{s.y}</span>
                      <span>{(s.loreCount ?? 0)} lore</span>
                    </p>
                    {s.description ? (
                      <p className="text-uf-muted text-xs mt-1 line-clamp-1">{s.description}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <NeonButton variant="ghost" onClick={() => startEdit(s)}>
                      <Pencil className="h-4 w-4" aria-hidden />
                      Edit
                    </NeonButton>
                    <NeonButton variant="danger" onClick={() => onDelete(s)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </NeonButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>
      </section>
    </OperatorShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs uppercase tracking-[0.16em] text-uf-muted">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] disabled:opacity-50"
      />
    </label>
  );
}
