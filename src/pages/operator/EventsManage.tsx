import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";

const KINDS = [
  ["lore_lab", "Lore Lab"],
  ["faction_meeting", "Faction Meeting"],
  ["arc", "Story Arc"],
  ["live_qa", "Live Q&A"],
  ["release", "Lore Release"],
  ["community", "Community"],
] as const;

const STATUS_VARIANT: Record<string, "info" | "success" | "warning" | "default" | "danger"> = {
  scheduled: "info",
  live: "success",
  ended: "default",
  cancelled: "danger",
};

export default function OperatorEvents() {
  const data = useQuery(api.events.listUpcomingEvents, {});
  const create = useMutation(api.events.createCalendarEvent);
  const setStatus = useMutation(api.events.setEventStatus);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    kind: "lore_lab",
    scheduledAt: "",
    endsAt: "",
    location: "",
    link: "",
  });

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const scheduledAt = new Date(form.scheduledAt).getTime();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Title and description are required.");
      return;
    }
    if (!Number.isFinite(scheduledAt)) {
      toast.error("Pick a start time.");
      return;
    }
    setBusy(true);
    try {
      await create({
        title: form.title.trim(),
        description: form.description.trim(),
        kind: form.kind,
        scheduledAt,
        endsAt: form.endsAt ? new Date(form.endsAt).getTime() : undefined,
        location: form.location.trim() || undefined,
        link: form.link.trim() || undefined,
      });
      toast.success("Event scheduled.");
      setForm({ title: "", description: "", kind: "lore_lab", scheduledAt: "", endsAt: "", location: "", link: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: Id<"calendarEvents">, status: string) {
    try {
      await setStatus({ id, status });
      toast.success(`Event marked ${status}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed.");
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <CalendarPlus className="h-6 w-6 text-uf-cyan" aria-hidden />
          Events Calendar
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Schedule the weekly Lore Lab, faction meetings, story arcs, live Q&amp;As,
          and lore-release countdowns shown on the public /events page.
        </p>
      </header>

      <HoloCard className="mb-8">
        <span className="uf-eyebrow">Schedule an event</span>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Title
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
              placeholder="Lore Lab — Week 12"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Kind
            <select
              value={form.kind}
              onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            >
              {KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1 md:col-span-2">
            Description
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
              rows={2}
              placeholder="What happens at this event, and why should the fleet show up?"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Starts
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              required
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Ends (optional)
            <input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Location (optional)
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Community Hub → Lore Lab"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Link (optional)
            <input
              value={form.link}
              onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              placeholder="https://…"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <NeonButton type="submit" variant="primary" loading={busy}>
              Schedule event
            </NeonButton>
          </div>
        </form>
      </HoloCard>

      <span className="uf-eyebrow">Upcoming events</span>
      {data === undefined ? (
        <div className="uf-skeleton mt-3" style={{ height: 160 }} />
      ) : data.events.length === 0 ? (
        <div className="uf-empty mt-3">No events scheduled yet.</div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3 list-none p-0 m-0">
          {data.events.map((e) => (
            <li key={e._id}>
              <HoloCard className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold">{e.title}</h3>
                      <StatusPill variant={STATUS_VARIANT[e.status] ?? "default"}>
                        {e.status}
                      </StatusPill>
                    </div>
                    <p className="text-uf-muted text-xs mt-1">
                      {new Date(e.scheduledAt).toLocaleString()}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.status === "scheduled" && (
                      <NeonButton variant="ghost" className="!px-3 !py-1 !text-xs" onClick={() => changeStatus(e._id, "live")}>
                        Mark live
                      </NeonButton>
                    )}
                    {e.status !== "ended" && e.status !== "cancelled" && (
                      <NeonButton variant="ghost" className="!px-3 !py-1 !text-xs" onClick={() => changeStatus(e._id, "ended")}>
                        End
                      </NeonButton>
                    )}
                    {e.status !== "cancelled" && (
                      <NeonButton variant="danger" className="!px-3 !py-1 !text-xs" onClick={() => changeStatus(e._id, "cancelled")}>
                        Cancel
                      </NeonButton>
                    )}
                  </div>
                </div>
              </HoloCard>
            </li>
          ))}
        </ul>
      )}
    </OperatorShell>
  );
}
