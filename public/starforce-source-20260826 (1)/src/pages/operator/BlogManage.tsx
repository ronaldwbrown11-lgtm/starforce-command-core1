import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, Star } from "lucide-react";

const CATEGORIES = ["announcement", "lore", "guide", "update"];

export default function OperatorBlog() {
  const posts = useQuery(api.blog.listPublished, { limit: 200 });
  const upsert = useMutation(api.blog.upsert);
  const remove = useMutation(api.blog.remove);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ title: "", slug: "", excerpt: "", body: "", category: "announcement", status: "draft", featured: false, coverUrl: "" });
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  function startEdit(post?: any) {
    if (post) {
      setForm({ title: post.title, slug: post.slug, excerpt: post.excerpt, body: post.body, category: post.category ?? "announcement", status: post.status, featured: post.featured ?? false, coverUrl: post.coverUrl ?? "" });
      setEditing(post);
    } else {
      setForm({ title: "", slug: "", excerpt: "", body: "", category: "announcement", status: "draft", featured: false, coverUrl: "" });
      setEditing(null);
    }
  }

  async function save() {
    if (!form.title.trim() || !form.slug.trim()) { toast.error("Title and slug required."); return; }
    setBusy(true);
    try {
      await upsert({ id: editing?._id, ...form });
      toast.success(editing ? "Post updated." : "Post created.");
      setEditing(null);
    } catch (e: any) { toast.error(e.message ?? "Save failed."); }
    finally { setBusy(false); }
  }

  async function del(id: any) {
    if (!window.confirm("Delete this post?")) return;
    try { await remove({ id }); toast.success("Deleted."); } catch (e: any) { toast.error(e.message); }
  }

  const filtered = useMemo(() => {
    const all = posts ?? [];
    if (!filter) return all;
    const q = filter.toLowerCase();
    return all.filter((p) => p.title.toLowerCase().includes(q) || p.slug.includes(q) || (p.category ?? "").includes(q));
  }, [posts, filter]);

  return (
    <OperatorShell>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <span className="uf-eyebrow">Operator Console</span>
          <h1 className="text-3xl font-semibold mt-2">Blog Posts</h1>
          <p className="text-uf-muted text-sm mt-1">Write and publish dispatches, announcements, and guides to the fleet.</p>
        </div>
        <NeonButton variant="primary" onClick={() => startEdit()}><Plus className="h-4 w-4 mr-1" />New post</NeonButton>
      </header>

      {editing !== null || false ? (
        <HoloCard className="mb-6">
          <h2 className="text-lg font-semibold mb-4">{editing?._id ? "Edit post" : "New post"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs uppercase tracking-widest text-uf-muted">Title<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" /></label>
            <label className="block text-xs uppercase tracking-widest text-uf-muted">Slug<input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm font-mono" /></label>
            <label className="block text-xs uppercase tracking-widest text-uf-muted sm:col-span-2">Excerpt<textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} rows={2} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" /></label>
            <label className="block text-xs uppercase tracking-widest text-uf-muted sm:col-span-2">Body (Markdown)<textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={12} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm font-mono" /></label>
            <label className="block text-xs uppercase tracking-widest text-uf-muted">Category<select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            <label className="block text-xs uppercase tracking-widest text-uf-muted">Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
            <label className="block text-xs uppercase tracking-widest text-uf-muted sm:col-span-2">Cover URL (optional)<input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="https://…" className="mt-1 w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" /></label>
          </div>
          <label className="flex items-center gap-2 mt-4 text-sm text-uf-muted cursor-pointer">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="rounded" />
            Featured on home page
          </label>
          <div className="flex justify-end gap-2 mt-4">
            <NeonButton variant="ghost" onClick={() => setEditing(null)} disabled={busy}>Cancel</NeonButton>
            <NeonButton variant="primary" onClick={save} loading={busy}>{editing?._id ? "Update" : "Create"}</NeonButton>
          </div>
        </HoloCard>
      ) : null}

      <div className="mb-4">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by title, slug, or category…" className="w-full max-w-md rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm" />
      </div>

      {posts === undefined ? <div className="uf-skeleton" style={{ height: 200 }} /> : filtered.length === 0 ? (
        <HoloCard><div className="uf-empty">No blog posts yet. Create your first one above.</div></HoloCard>
      ) : (
        <ul className="flex flex-col gap-2 list-none p-0 m-0">
          {filtered.map((p) => (
            <li key={p._id} className="flex flex-wrap items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-4 py-3 bg-[rgba(5,8,22,0.4)]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{p.title}</span>
                  {p.featured ? <Star className="h-3.5 w-3.5 text-[var(--uf-gold)]" /> : null}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-uf-muted">
                  <span className="font-mono">{p.slug}</span>
                  {p.category ? <StatusPill variant="default">{p.category}</StatusPill> : null}
                  <StatusPill variant={p.status === "published" ? "success" : p.status === "archived" ? "default" : "warning"}>{p.status}</StatusPill>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <NeonButton variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></NeonButton>
                <NeonButton variant="ghost" onClick={() => del(p._id)}><Trash2 className="h-4 w-4 text-uf-red" /></NeonButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </OperatorShell>
  );
}
