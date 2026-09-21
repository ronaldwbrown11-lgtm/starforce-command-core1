import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { GalaxyMapMini } from "@/components/widgets/GalaxyMapMini";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Loader2, Map as MapIcon, Pencil, Plus, Route, Trash2, X } from "lucide-react";

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

type GateFormState = {
  id?: Id<"warpGates">;
  label: string;
  fromSlug: string;
  toSlug: string;
  note: string;
};

type BoundaryFormState = {
  id?: Id<"mapBoundaries">;
  name: string;
  slugs: string[];
  note: string;
};

const EMPTY_GATE_FORM: GateFormState = {
  label: "",
  fromSlug: "",
  toSlug: "",
  note: "",
};

const EMPTY_BOUNDARY_FORM: BoundaryFormState = {
  name: "",
  slugs: [],
  note: "",
};

export default function OperatorSectorMap() {
  const sectors = useQuery(api.sectorMap.listSectorsForOperator);
  const upsert = useMutation(api.sectorMap.upsertSector);
  const remove = useMutation(api.sectorMap.deleteSector);
  const gates = useQuery(api.sectorMap.listGatesForOperator);
  const upsertGate = useMutation(api.sectorMap.upsertGate);
  const deleteGate = useMutation(api.sectorMap.deleteGate);
  const boundaries = useQuery(api.sectorMap.listBoundariesForOperator);
  const upsertBoundary = useMutation(api.sectorMap.upsertBoundary);
  const deleteBoundary = useMutation(api.sectorMap.deleteBoundary);
  const [editing, setEditing] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [gateEditing, setGateEditing] = useState<GateFormState | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [boundaryEditing, setBoundaryEditing] = useState<BoundaryFormState | null>(null);
  const [boundaryBusy, setBoundaryBusy] = useState(false);

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
    if (!window.confirm(`Delete sector "${s.name}" from the map? Its warp gates will be removed too.`)) return;
    try {
      await remove({ id: s._id });
      toast.success("Sector removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  async function saveGate() {
    if (!gateEditing) return;
    const label = gateEditing.label.trim();
    if (!label) return toast.error("Gate label is required.");
    if (!gateEditing.fromSlug || !gateEditing.toSlug) {
      return toast.error("Pick both ends of the corridor.");
    }
    if (gateEditing.fromSlug === gateEditing.toSlug) {
      return toast.error("A corridor cannot link a sector to itself.");
    }
    setGateBusy(true);
    try {
      await upsertGate({
        id: gateEditing.id,
        label,
        fromSlug: gateEditing.fromSlug,
        toSlug: gateEditing.toSlug,
        note: gateEditing.note.trim() || undefined,
      });
      toast.success(gateEditing.id ? "Gate updated." : "Gate added.");
      setGateEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setGateBusy(false);
    }
  }

  async function onDeleteGate(g: { _id: Id<"warpGates">; label: string; fromSlug: string; toSlug: string }) {
    if (!window.confirm(`Delete gate "${g.label}" (${g.fromSlug} ↔ ${g.toSlug})?`)) return;
    try {
      await deleteGate({ id: g._id });
      toast.success("Gate removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  const sectorName = (slug: string) =>
    sectors?.find((s) => s.slug === slug)?.name ?? slug;

  async function saveBoundary() {
    if (!boundaryEditing) return;
    const name = boundaryEditing.name.trim();
    if (!name) return toast.error("Boundary name is required.");
    if (boundaryEditing.slugs.length < 3) {
      return toast.error("A boundary needs at least 3 sector systems.");
    }
    setBoundaryBusy(true);
    try {
      await upsertBoundary({
        id: boundaryEditing.id,
        name,
        sectorSlugs: boundaryEditing.slugs,
        note: boundaryEditing.note.trim() || undefined,
      });
      toast.success(boundaryEditing.id ? "Boundary updated." : "Boundary added.");
      setBoundaryEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBoundaryBusy(false);
    }
  }

  async function onDeleteBoundary(b: { _id: Id<"mapBoundaries">; name: string }) {
    if (!window.confirm(`Delete boundary "${b.name}"?`)) return;
    try {
      await deleteBoundary({ id: b._id });
      toast.success("Boundary removed.");
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

      <section aria-label="Warp gate management" className="mb-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Route className="h-5 w-5 text-uf-cyan" aria-hidden />
              Starnet warp gates
              <span className="text-uf-muted text-sm">({gates?.length ?? "…"})</span>
            </h2>
            <p className="text-uf-muted text-xs mt-1 max-w-2xl">
              Transit corridors between two canon sectors. Each lane renders on
              the public map with a pulsing warp-gate marker at its midpoint —
              label them to match your lore. Until at least one gate exists,
              the public map falls back to simple pairwise connection lines.
            </p>
          </div>
          <NeonButton
            variant="primary"
            onClick={() => setGateEditing(EMPTY_GATE_FORM)}
            disabled={!sectors || sectors.length < 2}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New gate
          </NeonButton>
        </header>

        {gateEditing ? (
          <HoloCard className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">
                {gateEditing.id ? `Edit ${gateEditing.label}` : "Add warp gate"}
              </h3>
              <button
                type="button"
                aria-label="Close gate editor"
                className="uf-btn uf-btn--ghost"
                onClick={() => setGateEditing(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Corridor label"
                value={gateEditing.label}
                onChange={(v) => setGateEditing((f) => f && { ...f, label: v })}
                placeholder="Vega Run"
              />
              <div className="text-xs uppercase tracking-[0.16em] text-uf-muted">
                From sector
                <select
                  value={gateEditing.fromSlug}
                  onChange={(e) => setGateEditing((f) => f && { ...f, fromSlug: e.target.value })}
                  className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                >
                  <option value="">Select sector…</option>
                  {(sectors ?? []).map((s) => (
                    <option key={s._id} value={s.slug}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="text-xs uppercase tracking-[0.16em] text-uf-muted">
                To sector
                <select
                  value={gateEditing.toSlug}
                  onChange={(e) => setGateEditing((f) => f && { ...f, toSlug: e.target.value })}
                  className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                >
                  <option value="">Select sector…</option>
                  {(sectors ?? []).map((s) => (
                    <option key={s._id} value={s.slug}>{s.name}</option>
                  ))}
                </select>
              </div>
              <Field
                label="Note (optional)"
                value={gateEditing.note}
                onChange={(v) => setGateEditing((f) => f && { ...f, note: v })}
                placeholder="Primary military transit route"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <NeonButton variant="ghost" onClick={() => setGateEditing(null)} disabled={gateBusy}>
                Cancel
              </NeonButton>
              <NeonButton variant="primary" onClick={saveGate} loading={gateBusy} disabled={gateBusy}>
                {gateEditing.id ? "Save changes" : "Add gate"}
              </NeonButton>
            </div>
          </HoloCard>
        ) : null}

        <HoloCard>
          {gates === undefined ? (
            <div className="uf-skeleton" style={{ height: 120 }} />
          ) : gates.length === 0 ? (
            <p className="uf-empty">
              No warp gates yet. The public map draws simple connection lines
              until you register your first corridor.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {gates.map((g) => (
                <li
                  key={g._id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold truncate">{g.label}</p>
                    <p className="text-uf-muted text-xs flex flex-wrap items-center gap-2 mt-1">
                      <StatusPill variant="info">
                        {sectorName(g.fromSlug)} ↔ {sectorName(g.toSlug)}
                      </StatusPill>
                    </p>
                    {g.note ? (
                      <p className="text-uf-muted text-xs mt-1 line-clamp-1">{g.note}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <NeonButton
                      variant="ghost"
                      onClick={() =>
                        setGateEditing({
                          id: g._id,
                          label: g.label,
                          fromSlug: g.fromSlug,
                          toSlug: g.toSlug,
                          note: g.note ?? "",
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                      Edit
                    </NeonButton>
                    <NeonButton variant="danger" onClick={() => onDeleteGate(g)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </NeonButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>
      </section>

      <section aria-label="Named boundary management" className="mb-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Route className="h-5 w-5 text-uf-gold" aria-hidden />
              Named boundaries
              <span className="text-uf-muted text-sm">({boundaries?.length ?? "…"})</span>
            </h2>
            <p className="text-uf-muted text-xs mt-1 max-w-2xl">
              Frontier regions drawn as a polygon through canon sector systems —
              add the boundary systems as sectors first (with their lore), then
              list them here in order. Rendered on the public map with triangle
              markers at each vertex and the boundary's name along its center.
            </p>
          </div>
          <NeonButton
            variant="primary"
            onClick={() => setBoundaryEditing(EMPTY_BOUNDARY_FORM)}
            disabled={!sectors || sectors.length < 3}
          >
            <Plus className="h-4 w-4" aria-hidden />
            New boundary
          </NeonButton>
        </header>

        {boundaryEditing ? (
          <HoloCard className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">
                {boundaryEditing.id ? `Edit ${boundaryEditing.name}` : "Add boundary"}
              </h3>
              <button
                type="button"
                aria-label="Close boundary editor"
                className="uf-btn uf-btn--ghost"
                onClick={() => setBoundaryEditing(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <Field
                label="Boundary name"
                value={boundaryEditing.name}
                onChange={(v) => setBoundaryEditing((f) => f && { ...f, name: v })}
                placeholder="Orion Triangle"
              />
              <p className="text-xs uppercase tracking-[0.16em] text-uf-muted">
                Vertex systems (in drawing order — click to add, arrows to reorder)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {boundaryEditing.slugs.map((slug, i) => (
                  <span
                    key={`${slug}-${i}`}
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(230,168,23,0.5)] bg-[rgba(230,168,23,0.1)] px-2.5 py-1 text-xs text-uf-text"
                  >
                    {i + 1}. {sectorName(slug)}
                    <button
                      type="button"
                      aria-label={`Remove ${sectorName(slug)} from boundary`}
                      className="ml-0.5 text-uf-muted hover:text-uf-text"
                      onClick={() =>
                        setBoundaryEditing((f) => f && ({ ...f, slugs: f.slugs.filter((_, j) => j !== i) }))
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0}
                      className="ml-0.5 disabled:opacity-30 text-uf-muted hover:text-uf-text"
                      onClick={() =>
                        setBoundaryEditing((f) => {
                          if (!f || i === 0) return f;
                          const slugs = [...f.slugs];
                          [slugs[i - 1], slugs[i]] = [slugs[i], slugs[i - 1]];
                          return { ...f, slugs };
                        })
                      }
                    >
                      ↑
                    </button>
                  </span>
                ))}
              </div>
              <select
                aria-label="Add a vertex system"
                value=""
                onChange={(e) => {
                  const slug = e.target.value;
                  if (!slug) return;
                  setBoundaryEditing((f) =>
                    f && !f.slugs.includes(slug) ? { ...f, slugs: [...f.slugs, slug] } : f,
                  );
                }}
                className="w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              >
                <option value="">+ Add vertex system…</option>
                {(sectors ?? [])
                  .filter((s) => !boundaryEditing.slugs.includes(s.slug))
                  .map((s) => (
                    <option key={s._id} value={s.slug}>{s.name}</option>
                  ))}
              </select>
              <Field
                label="Note (optional)"
                value={boundaryEditing.note}
                onChange={(v) => setBoundaryEditing((f) => f && { ...f, note: v })}
                placeholder="Alliance frontier enclosing Sol and the capital"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <NeonButton variant="ghost" onClick={() => setBoundaryEditing(null)} disabled={boundaryBusy}>
                Cancel
              </NeonButton>
              <NeonButton variant="primary" onClick={saveBoundary} loading={boundaryBusy} disabled={boundaryBusy}>
                {boundaryEditing.id ? "Save changes" : "Add boundary"}
              </NeonButton>
            </div>
          </HoloCard>
        ) : null}

        <HoloCard>
          {boundaries === undefined ? (
            <div className="uf-skeleton" style={{ height: 100 }} />
          ) : boundaries.length === 0 ? (
            <p className="uf-empty">
              No boundaries defined. The public map shows the placeholder Orion
              Triangle until you register your first one from your sectors.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {boundaries.map((b) => (
                <li
                  key={b._id}
                  className="flex flex-wrap items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold">{b.name}</p>
                    <p className="text-uf-muted text-xs mt-1">
                      {b.sectorSlugs.map(sectorName).join(" → ")} → closed
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <NeonButton
                      variant="ghost"
                      onClick={() =>
                        setBoundaryEditing({ id: b._id, name: b.name, slugs: [...b.sectorSlugs], note: b.note ?? "" })
                      }
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                      Edit
                    </NeonButton>
                    <NeonButton variant="danger" onClick={() => onDeleteBoundary(b)}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </NeonButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>
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
