import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Users, Lock, Eye } from "lucide-react";

const CATEGORIES = [
  { value: "faction", label: "Faction (Ultra Force, G.I.A., Starforge, Chrono Monks)" },
  { value: "ship", label: "Starship crew" },
  { value: "planet", label: "Homeworld" },
  { value: "ops", label: "Operations" },
  { value: "intel", label: "Intel" },
  { value: "governance", label: "Governance" },
  { value: "social", label: "Social" },
];

const PRIVACY: Record<string, { label: string; icon: any; variant: "success" | "info" | "warning" }> = {
  public: { label: "Public", icon: Eye, variant: "success" },
  private: { label: "Private", icon: Lock, variant: "info" },
  classified: { label: "Classified", icon: Lock, variant: "warning" },
};

const EMPTY_FORM = {
  name: "",
  description: "",
  category: "ops",
  privacy: "public" as "public" | "private" | "classified",
};

export default function OperatorGroups() {
  const groups = useQuery(api.groups.adminListGroups);
  const createGroup = useMutation(api.groups.createGroup);
  const updateGroup = useMutation(api.groups.updateGroup);
  const deleteGroup = useMutation(api.groups.deleteGroup);

  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const items = useMemo(() => groups ?? [], [groups]);

  function startEdit(item?: any) {
    if (item) {
      setForm({
        name: item.name,
        description: item.description,
        category: item.category ?? "ops",
        privacy: item.privacy ?? "public",
      });
      setEditing(item);
    } else {
      setForm({ ...EMPTY_FORM });
      setEditing(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.name.trim()) { toast.error("Group name is required."); return; }
    if (!form.description.trim()) { toast.error("Group description is required."); return; }
    setBusy(true);
    try {
      if (editing) {
        const res = await updateGroup({
          id: editing._id,
          name: form.name,
          description: form.description,
          category: form.category,
          privacy: form.privacy,
        });
        toast.success("Group updated.");
        if (res.slug !== editing.slug) toast.info(`New address: /groups/${res.slug}`);
      } else {
        await createGroup({
          name: form.name,
          description: form.description,
          category: form.category,
          privacy: form.privacy,
        });
        toast.success("Group created.");
      }
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message ?? "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function del(item: any) {
    if (!window.confirm(`Delete group "${item.name}"? This removes its members, chat, posts, and events permanently.`)) return;
    try {
      await deleteGroup({ id: item._id });
      toast.success("Group deleted.");
    } catch (e: any) { toast.error(e.message); }
  }

  const filtered = useMemo(() => {
    const q = filter.toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      String(i.ownerName).toLowerCase().includes(q) ||
      i.category?.includes(q),
    );
  }, [items, filter]);

  return (
    <OperatorShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold mt-1 mb-1">Groups</h1>
            <p className="text-sm text-uf-muted">
              Every fleet group on the platform — {items.length} total · create, edit, or dissolve groups.
            </p>
          </div>
          <NeonButton onClick={() => startEdit()} aria-label="Add a new group">
            <Plus className="h-4 w-4" aria-hidden /> Add group
          </NeonButton>
        </div>

        {editing !== undefined && (
          <HoloCard>
            <h2 className="uf-eyebrow mb-4">{editing ? `Edit group: ${editing.name}` : "New group"}</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Name</span>
                <input
                  className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Sector Patrol 9"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Category</span>
                <select
                  className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm md:col-span-2">
                <span className="text-uf-muted">Description</span>
                <textarea
                  className="mt-1 w-full min-h-24 rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What's this group about?"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Privacy</span>
                <select
                  className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"
                  value={form.privacy}
                  onChange={(e) => setForm({ ...form, privacy: e.target.value as any })}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                  <option value="classified">Classified</option>
                </select>
              </label>
              {editing && (
                <div className="flex items-end text-sm text-uf-muted">
                  <span>Owner: {editing.ownerName} · Members: {editing.memberCount}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <NeonButton onClick={save} disabled={busy}>
                {busy ? "Saving…" : editing ? "Save changes" : "Create group"}
              </NeonButton>
              <NeonButton variant="ghost" onClick={() => setEditing(undefined)}>Cancel</NeonButton>
            </div>
          </HoloCard>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-uf-muted" aria-hidden />
          <input
            className="w-full max-w-md rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] py-2 pl-9 pr-3 text-sm"
            placeholder="Filter groups…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter groups"
          />
        </div>

        <HoloCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--uf-border)] text-left text-xs uppercase tracking-[0.14em] text-uf-muted">
                  <th className="px-4 py-3 font-medium">Group</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Privacy</th>
                  <th className="px-4 py-3 font-medium">Members</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => {
                  const p = PRIVACY[g.privacy] ?? PRIVACY.public;
                  const PIcon = p.icon;
                  return (
                    <tr key={g._id} className="border-b border-[color:var(--uf-border)] last:border-0 hover:bg-[rgba(0,229,255,0.04)]">
                      <td className="px-4 py-3">
                        <a href={`/groups/${g.slug}`} className="font-semibold hover:text-[color:var(--uf-cyan)]" target="_blank" rel="noreferrer">
                          {g.name}
                        </a>
                        <p className="text-xs text-uf-muted line-clamp-1 max-w-xs">{g.description}</p>
                      </td>
                      <td className="px-4 py-3 text-uf-muted capitalize">{g.category ?? "ops"}</td>
                      <td className="px-4 py-3">
                        <StatusPill variant={p.variant}><PIcon className="h-3 w-3 inline mr-1" aria-hidden />{p.label}</StatusPill>
                      </td>
                      <td className="px-4 py-3 text-uf-muted">
                        <Users className="h-3.5 w-3.5 inline mr-1" aria-hidden />{g.memberCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-uf-muted">{g.ownerName}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text"
                            onClick={() => startEdit(g)}
                            aria-label={`Edit ${g.name}`}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[color:var(--uf-border)] text-uf-muted hover:text-red-400"
                            onClick={() => del(g)}
                            aria-label={`Delete ${g.name}`}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-uf-muted">
                      {items.length === 0 ? "No groups yet. Add your first one." : `No groups match "${filter}".`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </HoloCard>
      </div>
    </OperatorShell>
  );
}