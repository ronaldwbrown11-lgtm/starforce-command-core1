import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Ship, Database } from "lucide-react";
import { fetchRegistryFleet } from "@/lib/fleetRegistry";
import { toVesselInput } from "@/lib/vesselSync";
import type { Doc } from "@/convex/_generated/dataModel";

const BADGES = ["CARRIER", "DREADNAUGHT", "DESTROYER", "BATTLESHIP", "FLAGSHIP", "TRANSPORT", "ESCORT", "SUPPRESSION", "DRONE", "STEALTH", "MEDICAL", "INDUSTRIAL", "STRIKE", "INTERCEPTOR", "FIGHTER", "CORVETTE", "FRIGATE"];

const EMPTY = { designation: "", name: "", badge: "ACTIVE", shipClass: "", registry: "", role: "", crew: "", armament: "", notes: "", hullLength: "", hullWidth: "", decks: "", weight: "", acceleration: "" };

export default function FleetManage() {
  const vessels = useQuery(api.vessels.listAll);
  const upsert = useMutation(api.vessels.upsert);
  const remove = useMutation(api.vessels.remove);
  const syncFromRegistry = useMutation(api.vessels.syncFromRegistry);
  const [editing, setEditing] = useState<Doc<"vessels"> | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  function startEdit(v?: Doc<"vessels">) {
    if (v) {
      setForm({ designation: v.designation, name: v.name, badge: v.badge, shipClass: v.shipClass ?? "", registry: v.registry ?? "", role: v.role, crew: v.crew ?? "", armament: v.armament ?? "", notes: v.notes ?? "", hullLength: v.hullLength ?? "", hullWidth: v.hullWidth ?? "", decks: v.decks ?? "", weight: v.weight ?? "", acceleration: v.acceleration ?? "" });
      setEditing(v);
    } else {
      setForm(EMPTY);
      setEditing(null);
    }
  }

  async function save() {
    if (!form.designation.trim() || !form.name.trim() || !form.role.trim()) { toast.error("Designation, name, and role are required."); return; }
    setBusy(true);
    try {
      await upsert({ id: editing?._id, ...form });
      toast.success(editing ? "Vessel updated." : "Vessel added.");
      setEditing(null);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed."); }
    finally { setBusy(false); }
  }

  async function del(id: Doc<"vessels">["_id"]) {
    if (!window.confirm("Remove this vessel from the registry?")) return;
    try { await remove({ id }); toast.success("Removed."); } catch (e) { toast.error(e instanceof Error ? e.message : "Remove failed."); }
  }

  /**
   * Reseed this list from the live fleet database. The database is the source
   * of truth: rows are matched and updated in place, new vessels are added,
   * and vessels the database no longer carries are removed — which is why
   * editing a ship there and pressing this button actually changes the list.
   */
  async function reseed() {
    if (busy) return;
    setBusy(true);
    try {
      const records = await fetchRegistryFleet();
      const rows = records
        .map(toVesselInput)
        .filter((row): row is NonNullable<typeof row> => row !== null);
      if (rows.length === 0) {
        toast.error("The fleet database returned no vessels — nothing was reseeded.");
        return;
      }
      const ok = window.confirm(
        `Reseed this list from the live Fleet Registry database (${rows.length} vessels)? ` +
          "Rows are updated in place, new vessels are added, and vessels the database no longer carries are removed.",
      );
      if (!ok) return;
      const res = await syncFromRegistry({ vessels: rows });
      toast.success(
        `Reseeded from the fleet database — ${res.updated} updated, ${res.created} added, ${res.removed} removed.`,
      );
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Reseed failed — ${e.message}`
          : "Reseed failed — the fleet database could not be reached.",
      );
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const all = vessels ?? [];
    if (!filter) return all;
    const q = filter.toLowerCase();
    return all.filter((v) => v.designation.toLowerCase().includes(q) || v.name.toLowerCase().includes(q) || v.badge.toLowerCase().includes(q) || (v.shipClass ?? "").toLowerCase().includes(q));
  }, [vessels, filter]);

  function field(label: string, key: string, opts?: { placeholder?: string; required?: boolean }) {
    return (
      <label className="block text-xs uppercase tracking-widest text-uf-muted">
        {label}{opts?.required ? " *" : ""}
        <input value={(form as Record<string, string>)[key] ?? ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={opts?.placeholder} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" />
      </label>
    );
  }

  return (
    <OperatorShell>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <span className="uf-eyebrow">Operator Console</span>
          <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3"><Ship className="h-6 w-6 text-uf-cyan" />Fleet Registry</h1>
          <p className="text-uf-muted text-sm mt-1">
            Manage the vessel records shown in this console. <strong>Seed vessels</strong> reseeds
            this list from the live Fleet Registry database.
          </p>
        </div>
        <div className="flex gap-2">
          <NeonButton variant="ghost" onClick={reseed} loading={busy}>
            <Database className="h-4 w-4 mr-1" />Seed vessels
          </NeonButton>
          <NeonButton variant="primary" onClick={() => startEdit()}><Plus className="h-4 w-4 mr-1" />Add vessel</NeonButton>
        </div>
      </header>

      {editing !== null || false ? (
        <HoloCard className="mb-6">
          <h2 className="text-lg font-semibold mb-4">{editing?._id ? "Edit vessel" : "New vessel"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("Designation", "designation", { required: true, placeholder: "OMEGA MAJESTY" })}
            {field("Name", "name", { required: true, placeholder: "Omega Majesty" })}
            <label className="block text-xs uppercase tracking-widest text-uf-muted">
              Badge *
              <select value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm">
                {BADGES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            {field("Ship Class", "shipClass", { placeholder: "Omega-Class Super Battleship" })}
            {field("Registry", "registry", { placeholder: "SFSBT 8005" })}
            {field("Role", "role", { required: true, placeholder: "Strategic fleet flagship" })}
            {field("Crew", "crew", { placeholder: "5,000 CREW" })}
            {field("Hull Length (m)", "hullLength", { placeholder: "1400" })}
            {field("Hull Width (m)", "hullWidth", { placeholder: "500" })}
            {field("Decks", "decks", { placeholder: "40" })}
            {field("Weight", "weight", { placeholder: "450,000 TONNES" })}
            {field("Acceleration", "acceleration", { placeholder: "WARP ONE POINT TWO" })}
          </div>
          <div className="mt-3">
            {field("Armament", "armament", { placeholder: "2× QUANTUM SINGULARITY PROJECTORS; ..." })}
          </div>
          <div className="mt-3">
            {field("Notes", "notes", { placeholder: "Operational notes" })}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <NeonButton variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</NeonButton>
            <NeonButton variant="primary" onClick={save} loading={busy}>{editing?._id ? "Update" : "Add"}</NeonButton>
          </div>
        </HoloCard>
      ) : null}

      <div className="mb-4">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by designation, name, class…" className="w-full max-w-md rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" />
      </div>

      {vessels === undefined ? <div className="uf-skeleton" style={{ height: 200 }} /> : filtered.length === 0 ? (
        <HoloCard><div className="uf-empty">No vessels in the registry. Add one or click "Seed vessels" to pull the fleet in from the Fleet Registry database.</div></HoloCard>
      ) : (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {filtered.map((v) => (
            <li key={v._id} className="flex flex-wrap items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-4 py-3 bg-[rgba(5,8,22,0.4)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">
                    {v.name && v.name !== v.designation ? v.name : v.designation}
                  </span>
                  {v.name && v.name !== v.designation ? (
                    <span className="text-xs text-uf-muted font-mono">{v.designation}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-uf-muted">
                  <StatusPill variant="info">{v.badge}</StatusPill>
                  {v.shipClass ? <span>{v.shipClass}</span> : null}
                  {v.registry ? <span className="font-mono">{v.registry}</span> : null}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <NeonButton variant="ghost" onClick={() => startEdit(v)}><Pencil className="h-4 w-4" /></NeonButton>
                <NeonButton variant="ghost" onClick={() => del(v._id)}><Trash2 className="h-4 w-4 text-uf-red" /></NeonButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OperatorShell>
  );
}
