import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Library } from "lucide-react";
import {
  FAQ_SEED,
  FAQ_CATEGORY_KEYS,
  FAQ_CATEGORY_LABELS,
} from "@/lib/faqSeed";

export default function OperatorFaqs() {
  const items = useQuery(api.faqs.listPublished);
  const upsert = useMutation(api.faqs.upsert);
  const remove = useMutation(api.faqs.remove);
  const seedDefaults = useMutation(api.faqs.seedDefaults);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ question: "", answer: "", category: "general", order: 0, status: "published" });
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Seed rows (served read-only while the table is empty) carry "seed:" ids.
  const isSeed = (item: any) =>
    typeof item?._id === "string" && item._id.startsWith("seed:");

  function startEdit(item?: any) {
    if (item && !isSeed(item)) {
      setForm({ question: item.question, answer: item.answer, category: item.category, order: item.order ?? 0, status: item.status });
      setEditing(item);
    } else if (item) {
      // Seed row — prefill a NEW editable item from the canonical copy.
      setForm({ question: item.question, answer: item.answer, category: item.category, order: item.order ?? 0, status: "published" });
      setEditing(null);
    } else {
      setForm({ question: "", answer: "", category: "general", order: (items?.length ?? 0), status: "published" });
      setEditing(null);
    }
    setShowForm(true);
  }

  async function save() {
    if (!form.question.trim() || !form.answer.trim()) { toast.error("Question and answer required."); return; }
    setBusy(true);
    try {
      await upsert({ id: editing?._id, ...form });
      toast.success(editing ? "FAQ updated." : "FAQ created.");
      setEditing(null);
      setShowForm(false);
    } catch (e: any) { toast.error(e.message ?? "Save failed."); }
    finally { setBusy(false); }
  }

  async function del(id: any) {
    if (!window.confirm("Delete this FAQ?")) return;
    try { await remove({ id }); toast.success("Deleted."); } catch (e: any) { toast.error(e.message); }
  }

  async function runSeed() {
    if (seeding) return;
    setSeeding(true);
    try {
      const res = await seedDefaults({});
      toast.success(
        res.added > 0
          ? `Seeded ${res.added} of ${res.catalog} canonical FAQs — existing items untouched.`
          : "Nothing to seed — the full canonical library already exists.",
      );
    } catch (e: any) {
      toast.error(e.message ?? "Seeding failed.");
    } finally {
      setSeeding(false);
    }
  }

  const filtered = useMemo(() => {
    const all = items ?? [];
    if (!filter) return all;
    const q = filter.toLowerCase();
    return all.filter((i) => i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q) || i.category.includes(q));
  }, [items, filter]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const item of filtered) {
      const key = item.category ?? "general";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filtered]);

  return (
    <OperatorShell>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="uf-eyebrow">Operator Console</span>
          <h1 className="text-3xl font-semibold mt-2">FAQs</h1>
          <p className="text-uf-muted text-sm mt-1">Manage the frequently asked questions shown on the public FAQ page.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NeonButton variant="ghost" onClick={() => void runSeed()} loading={seeding}>
            <Library className="h-4 w-4 mr-1" aria-hidden />
            Seed default library ({FAQ_SEED.length})
          </NeonButton>
          <NeonButton variant="primary" onClick={() => startEdit()}><Plus className="h-4 w-4 mr-1" />New FAQ</NeonButton>
        </div>
      </header>

      {showForm ? (
        <HoloCard className="mb-6">
          <h2 className="text-lg font-semibold mb-4">{editing?._id ? "Edit FAQ" : "New FAQ"}</h2>
          <div className="grid gap-3">
            <label className="block text-xs uppercase tracking-widest text-uf-muted">Question<input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" /></label>
            <label className="block text-xs uppercase tracking-widest text-uf-muted">Answer<textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} rows={4} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs uppercase tracking-widest text-uf-muted">Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm">{FAQ_CATEGORY_KEYS.map((c) => <option key={c} value={c}>{FAQ_CATEGORY_LABELS[c]}</option>)}</select></label>
              <label className="block text-xs uppercase tracking-widest text-uf-muted">Order<input type="number" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value) })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" /></label>
              <label className="block text-xs uppercase tracking-widest text-uf-muted">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"><option value="published">Published</option><option value="draft">Draft</option></select></label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <NeonButton variant="ghost" onClick={() => setShowForm(false)} disabled={busy}>Cancel</NeonButton>
            <NeonButton variant="primary" onClick={save} loading={busy}>{editing?._id ? "Update" : "Create"}</NeonButton>
          </div>
        </HoloCard>
      ) : null}

      <div className="mb-4">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search questions or answers…" className="w-full max-w-md rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" />
      </div>

      {items === undefined ? <div className="uf-skeleton" style={{ height: 200 }} /> : filtered.length === 0 ? (
        <HoloCard><div className="uf-empty">No FAQ items yet. Seed the default library or create your first one above.</div></HoloCard>
      ) : (
        Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="mb-6">
            <h2 className="text-base font-semibold text-uf-text mb-2">
              {FAQ_CATEGORY_LABELS[cat as keyof typeof FAQ_CATEGORY_LABELS] ?? cat}{" "}
              <span className="text-uf-muted font-normal text-sm">({catItems.length})</span>
            </h2>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {catItems.map((item) => {
                const seed = isSeed(item);
                return (
                  <li key={item._id} className="flex flex-wrap items-start justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-4 py-3 bg-[rgba(5,8,22,0.4)]">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{item.question}</p>
                      <p className="text-uf-muted text-xs mt-1 line-clamp-2">{item.answer}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusPill variant={seed ? "info" : item.status === "published" ? "success" : "warning"}>{seed ? "seed (not in DB)" : item.status}</StatusPill>
                        <span className="text-xs text-uf-muted font-mono">order: {item.order ?? 0}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <NeonButton variant="ghost" onClick={() => startEdit(item)} title={seed ? "Copy into a new editable item" : "Edit"}><Pencil className="h-4 w-4" /></NeonButton>
                      {!seed && (
                        <NeonButton variant="ghost" onClick={() => del(item._id)} title="Delete"><Trash2 className="h-4 w-4 text-uf-red" /></NeonButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </OperatorShell>
  );
}
