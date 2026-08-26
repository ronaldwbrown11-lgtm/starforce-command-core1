import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export default function OperatorChangelog() {
  const entries = useQuery(api.changelog.listChangelog, { limit: 30 });
  const post = useMutation(api.changelog.postChangelog);
  const remove = useMutation(api.changelog.deleteChangelog);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and notes are required.");
      return;
    }
    setBusy(true);
    try {
      await post({
        title: title.trim(),
        body: body.trim(),
        version: version.trim() || undefined,
      });
      toast.success("Changelog entry published.");
      setTitle("");
      setBody("");
      setVersion("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Post failed.");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: Id<"changelogEntries">) {
    if (!window.confirm("Delete this changelog entry?")) return;
    try {
      await remove({ id });
      toast.success("Entry deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <Rocket className="h-6 w-6 text-uf-cyan" aria-hidden />
          Changelog
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Post release notes and platform updates for the fleet. Entries appear
          on the public /changelog timeline.
        </p>
      </header>

      <HoloCard className="mb-8">
        <span className="uf-eyebrow">New update</span>
        <form onSubmit={handlePost} className="mt-4 flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1 md:col-span-2">
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={160}
                placeholder="Signal Vault, Events calendar, and the weekly digest"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
              Version (optional)
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                maxLength={40}
                placeholder="0.9.4"
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
            </label>
          </div>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Notes
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={6}
              maxLength={5000}
              placeholder={"What shipped, what changed, what's next. Bullet lists render as written.\n\n• New: …\n• Fixed: …"}
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <div className="flex justify-end">
            <NeonButton type="submit" variant="primary" loading={busy}>
              Publish update
            </NeonButton>
          </div>
        </form>
      </HoloCard>

      <span className="uf-eyebrow">Published entries</span>
      {entries === undefined ? (
        <div className="uf-skeleton mt-3" style={{ height: 160 }} />
      ) : entries.length === 0 ? (
        <div className="uf-empty mt-3">No changelog entries yet.</div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3 list-none p-0 m-0">
          {entries.map((e) => (
            <li key={e._id}>
              <HoloCard className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{e.title}</h3>
                      {e.version ? (
                        <StatusPill variant="violet">v{e.version}</StatusPill>
                      ) : null}
                    </div>
                    <p className="text-uf-muted text-xs mt-0.5">
                      {new Date(e.publishedAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-uf-text/85 mt-2 whitespace-pre-wrap max-w-3xl">
                      {e.body}
                    </p>
                  </div>
                  <NeonButton
                    variant="danger"
                    className="!px-3 !py-1 !text-xs shrink-0"
                    onClick={() => del(e._id)}
                  >
                    Delete
                  </NeonButton>
                </div>
              </HoloCard>
            </li>
          ))}
        </ul>
      )}
    </OperatorShell>
  );
}
