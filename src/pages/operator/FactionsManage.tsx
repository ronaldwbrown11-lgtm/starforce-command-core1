import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RotateCcw, Search, Eye, EyeOff } from "lucide-react";
import { FACTION_CATEGORIES, CATEGORY_MAP } from "@/lib/factions";
import { FactionIcon } from "@/components/factions/FactionIcon";

const ACCENT_PRESETS = [
  "#00E5FF", "#1E88E5", "#38BDF8", "#0EA5E9",
  "#7A2BD9", "#8B5CF6", "#A78BFA", "#C084FC",
  "#E6A817", "#F7C948", "#FFD166", "#F77F2A",
  "#EF4444", "#0FE2C0", "#34D399", "#A3E635",
];

const EMPTY_FORM = {
  name: "",
  category: "internal",
  description: "",
  accent: "#00E5FF",
  icon: "",
  order: 0,
  active: true,
};

export default function OperatorFactions() {
  const data = useQuery(api.factions.listAll);
  const upsert = useMutation(api.factions.upsert);
  const remove = useMutation(api.factions.remove);
  const setActive = useMutation(api.factions.setActive);
  const seed = useMutation(api.factions.seed);

  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const items = useMemo(() => (data?.items ?? []), [data]);

  function startEdit(item?: any) {
    if (item) {
      setForm({
        name: item.name,
        category: item.category,
        description: item.description,
        accent: item.accent ?? "#00E5FF",
        icon: item.icon ?? "",
        order: item.order ?? 0,
        active: item.active ?? true,
      });
      setEditing(item);
    } else {
      setForm({ ...EMPTY_FORM, order: items.length });
      setEditing(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Faction name is required."); return; }
    if (!form.description.trim()) { toast.error("Faction description is required."); return; }
    setBusy(true);
    try {
      await upsert({
        id: editing?._id,
        name: form.name,
        category: form.category,
        description: form.description,
        accent: form.accent,
        icon: form.icon || undefined,
        order: form.order,
        active: form.active,
      });
      toast.success(editing ? "Faction updated." : "Faction created.");
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message ?? "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function del(item: any) {
    if (!window.confirm(`Delete faction "${item.name}"? This cannot be undone.`)) return;
    try {
      await remove({ id: item._id });
      toast.success("Faction deleted.");
    } catch (e: any) { toast.error(e.message); }
  }

  async function toggleActive(item: any) {
    try {
      await setActive({ id: item._id, active: !item.active });
      toast.success(item.active ? "Faction hidden." : "Faction visible.");
    } catch (e: any) { toast.error(e.message); }
  }

  async function restoreDefaults() {
    if (!window.confirm("Restore any missing canon factions? Existing factions are never overwritten.")) return;
    setSeeding(true);
    try {
      const res = await seed();
      toast.success(
        res.inserted > 0 ? `Seeded ${res.inserted} missing factions.` : "All canon factions already present.",
      );
    } catch (e: any) { toast.error(e.message); }
    finally { setSeeding(false); }
  }

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.category.includes(q),
    );
  }, [items, filter]);

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const cat of FACTION_CATEGORIES) map[cat.key] = [];
    for (const item of filtered) {
      const key = item.category;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [filtered]);

  const visibleCount = items.filter((i) => i.active).length;

  return (
    <OperatorShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold mt-1 mb-1">Faction Registry</h1>
            <p className="text-sm text-uf-muted">
              Canon factions across human, Orion, fleet, and species groups — {visibleCount} of {items.length} visible
              {data && !data.stored ? " · showing seed catalog (not yet stored)" : ""}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NeonButton
              variant="ghost"
              onClick={restoreDefaults}
              disabled={seeding}
              aria-label="Restore missing canon factions"
            >
              <RotateCcw className="h-4 w-4" aria-hidden /> {seeding ? "Seeding…" : "Restore defaults"}
            </NeonButton>
            <NeonButton onClick={() => startEdit()} aria-label="Add a new faction">
              <Plus className="h-4 w-4" aria-hidden /> Add faction
            </NeonButton>
          </div>
        </div>

        {editing !== undefined && (
          <HoloCard>
            <h2 className="uf-eyebrow mb-4">{editing ? "Edit faction" : "New faction"}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Name</span>
                <input
                  className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Star Force"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Category</span>
                <select
                  className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {FACTION_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm md:col-span-2">
                <span className="text-uf-muted">Description</span>
                <textarea
                  className="mt-1 w-full min-h-24 rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Immersive canon description…"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Accent color</span>
                <div className="flex flex-wrap items-center gap-2">
                  {ACCENT_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, accent: c })}
                      className={`h-7 w-7 rounded-full border-2 ${form.accent === c ? "border-uf-text scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Accent ${c}`}
                      title={c}
                    />
                  ))}
                  <input
                    type="color"
                    className="h-8 w-10 cursor-pointer rounded border border-[color:var(--uf-border)] bg-transparent"
                    value={form.accent}
                    onChange={(e) => setForm({ ...form, accent: e.target.value })}
                    aria-label="Custom accent color"
                  />
                </div>
              </label>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Emblem icon (optional)</span>
                <div className="flex items-center gap-2">
                  <input
                    className="mt-1 w-full flex-1 rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="shield, eye, ghost…"
                    list="faction-icons"
                  />
                  {form.icon && (
                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--uf-border)]">
                      <FactionIcon name={form.icon} className="h-4 w-4" accent={form.accent} />
                    </span>
                  )}
                </div>
                <datalist id="faction-icons">
                  {["shield", "crosshair", "eye", "zap", "orbit", "landmark", "scale", "building2", "sun", "star", "rocket", "layers", "command", "swords", "waves", "ghost", "clock", "weight", "feather", "flame", "wind", "gem", "eclipse", "moon-star", "mountain", "droplets", "box", "sparkles", "moon", "users", "crown"].map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-cyan-400"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span className="text-uf-muted">Visible in registry</span>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Sort order</span>
                <input
                  type="number"
                  className="mt-1 w-28 rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <NeonButton onClick={save} disabled={busy}>
                {busy ? "Saving…" : editing ? "Save changes" : "Create faction"}
              </NeonButton>
              <NeonButton variant="ghost" onClick={() => setEditing(undefined)}>Cancel</NeonButton>
            </div>
          </HoloCard>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-uf-muted" aria-hidden />
          <input
            className="w-full max-w-md rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] py-2 pl-9 pr-3 text-sm"
            placeholder="Filter factions…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter factions"
          />
        </div>

        {FACTION_CATEGORIES.map((cat) => {
          const list = grouped[cat.key] ?? [];
          if (list.length === 0) return null;
          return (
            <section key={cat.key} aria-label={cat.label}>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.accent }} aria-hidden />
                <h2 className="uf-eyebrow">{cat.label}</h2>
                <span className="text-xs text-uf-muted">{list.length}</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((item) => (
                  <HoloCard key={item._id ?? item.slug} className="p-4">
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                        style={{ borderColor: `${item.accent}55`, backgroundColor: `${item.accent}14` }}
                        aria-hidden
                      >
                        <FactionIcon name={item.icon} className="h-5 w-5" accent={item.accent} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold leading-tight">{item.name}</h3>
                          {item.active ? (
                            <StatusPill variant="success">active</StatusPill>
                          ) : (
                            <StatusPill variant="warning">hidden</StatusPill>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-uf-muted leading-relaxed">{item.description}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-uf-muted/70">
                          {CATEGORY_MAP[item.category as keyof typeof CATEGORY_MAP]?.label ?? item.category} · {item.slug}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text"
                          onClick={() => startEdit(item)}
                          aria-label={`Edit ${item.name}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text"
                          onClick={() => toggleActive(item)}
                          aria-label={item.active ? `Hide ${item.name}` : `Show ${item.name}`}
                          title={item.active ? "Hide" : "Show"}
                        >
                          {item.active ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--uf-border)] text-uf-muted hover:text-red-400"
                          onClick={() => del(item)}
                          aria-label={`Delete ${item.name}`}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </HoloCard>
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <HoloCard className="p-8 text-center text-uf-muted">
            No factions match "{filter}". {items.length === 0 ? "Add your first faction." : ""}
          </HoloCard>
        )}
      </div>
    </OperatorShell>
  );
}