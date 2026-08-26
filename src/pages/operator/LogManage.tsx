import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { ShipWheel } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

export default function OperatorLog() {
  const logs = useQuery(api.captainLog.listCaptainLogs, {});
  const post = useMutation(api.captainLog.postCaptainLog);
  const remove = useMutation(api.captainLog.deleteCaptainLog);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function handlePost(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and entry are required.");
      return;
    }
    setBusy(true);
    try {
      await post({ title: title.trim(), body: body.trim() });
      toast.success("Log entry posted.");
      setTitle("");
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Post failed.");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: Id<"captainLogs">) {
    if (!window.confirm("Delete this log entry?")) return;
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
          <ShipWheel className="h-6 w-6 text-uf-cyan" aria-hidden />
          Captain's Log
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Post daily behind-the-scenes updates for the fleet. Newest entries
          appear on the Community page — a daily Captain's Log is the fastest
          way to keep the universe feeling guided and alive.
        </p>
      </header>

      <HoloCard className="mb-8">
        <span className="uf-eyebrow">New entry</span>
        <form onSubmit={handlePost} className="mt-4 flex flex-col gap-3">
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder="Log 047 — First light over New Terra"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Entry
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={5}
              maxLength={4000}
              placeholder="What happened on the bridge today? Notes, shout-outs, plans…"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <div className="flex justify-end">
            <NeonButton type="submit" variant="primary" loading={busy}>
              Post to the fleet
            </NeonButton>
          </div>
        </form>
      </HoloCard>

      <span className="uf-eyebrow">Recent entries</span>
      {logs === undefined ? (
        <div className="uf-skeleton mt-3" style={{ height: 160 }} />
      ) : logs.length === 0 ? (
        <div className="uf-empty mt-3">No log entries yet — write the first one.</div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3 list-none p-0 m-0">
          {logs.map((l) => (
            <li key={l._id}>
              <HoloCard className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{l.title}</h3>
                      <StatusPill variant="cyan">{l.author?.rank ?? "Recruit"}</StatusPill>
                    </div>
                    <p className="text-uf-muted text-xs mt-0.5">
                      {new Date(l.publishedAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-uf-text/85 mt-2 whitespace-pre-wrap max-w-3xl">
                      {l.body}
                    </p>
                  </div>
                  <NeonButton
                    variant="danger"
                    className="!px-3 !py-1 !text-xs shrink-0"
                    onClick={() => del(l._id)}
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
