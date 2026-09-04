import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Plus, RadioTower, Rocket, Trash2 } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");
function toLocalInput(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type PhaseRow = { title: string; unlockAt: string; blurb: string };

export default function ArgManage() {
  const campaigns = useQuery(api.arg.listArgCampaigns);
  const create = useMutation(api.arg.createArgCampaign);
  const setStatus = useMutation(api.arg.setArgCampaignStatus);

  const [season, setSeason] = useState("2");
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [startsAt, setStartsAt] = useState(() => toLocalInput(Date.now()));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(Date.now() + 30 * 86_400_000));
  const [phases, setPhases] = useState<PhaseRow[]>([
    { title: "", unlockAt: toLocalInput(Date.now() + 7 * 86_400_000), blurb: "" },
    { title: "", unlockAt: toLocalInput(Date.now() + 14 * 86_400_000), blurb: "" },
  ]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const updatePhase = (idx: number, patch: Partial<PhaseRow>) =>
    setPhases((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const addPhase = () =>
    setPhases((prev) => [
      ...prev,
      {
        title: "",
        unlockAt: toLocalInput(
          (prev[prev.length - 1]?.unlockAt
            ? new Date(prev[prev.length - 1].unlockAt).getTime()
            : Date.now()) + 7 * 86_400_000,
        ),
        blurb: "",
      },
    ]);
  const removePhase = (idx: number) => {
    if (phases.length <= 1) return;
    setPhases((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const startTs = new Date(startsAt).getTime();
      const endTs = new Date(endsAt).getTime();
      if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
        throw new Error("Pick valid campaign dates.");
      }
      const phaseInput = phases.map((p) => ({
        title: p.title,
        blurb: p.blurb,
        unlockAt: new Date(p.unlockAt).getTime(),
      }));
      if (phaseInput.some((p) => !Number.isFinite(p.unlockAt))) {
        throw new Error("Every phase needs a valid unlock time.");
      }
      const res = await create({
        season: Number(season),
        title,
        tagline,
        startsAt: startTs,
        endsAt: endTs,
        phases: phaseInput,
      });
      toast.success(`Season ${season} launched — the Vault now runs on it.`);
      setTitle("");
      setTagline("");
      setStartsAt(toLocalInput(Date.now()));
      setEndsAt(toLocalInput(Date.now() + 30 * 86_400_000));
      setPhases([
        { title: "", unlockAt: toLocalInput(Date.now() + 7 * 86_400_000), blurb: "" },
        { title: "", unlockAt: toLocalInput(Date.now() + 14 * 86_400_000), blurb: "" },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't launch the campaign.");
    } finally {
      setCreating(false);
    }
  };

  const handleStatus = async (id: Id<"argCampaigns">, status: "upcoming" | "active" | "concluded") => {
    setBusy(`status-${id}`);
    try {
      await setStatus({ id, status });
      toast.success(`Campaign moved to “${status}”.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status change failed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <OperatorShell>
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight mb-2">ARG Campaigns</h1>
        <p className="text-uf-muted text-sm mb-6">
          Run the Signal Vault season-by-season. Each campaign has a phase
          timeline that unlocks on schedule; signals created with a campaign
          assigned only surface while that season drives the Vault.
        </p>

        <HoloCard accent="violet" className="mb-8">
          <h2 className="uf-eyebrow mb-1 flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5" aria-hidden /> Launch a season
          </h2>
          <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
              Season number
              <input
                type="number"
                min={1}
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
              Season title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder='e.g. The Nine-Minute Signal'
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5 md:col-span-2">
              Tagline
              <input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                required
                placeholder="One line that pitches the season to the fleet."
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
              Season starts
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>
            <label className="text-xs uppercase tracking-[0.14em] text-uf-muted flex flex-col gap-1.5">
              Season ends
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
              />
            </label>

            <fieldset className="md:col-span-2 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.3)] p-3">
              <legend className="px-1 text-xs uppercase tracking-[0.14em] text-uf-muted">
                Phase timeline (unlocks in order)
              </legend>
              <div className="flex flex-col gap-3">
                {phases.map((p, idx) => (
                  <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_auto_1.4fr_auto] items-center">
                    <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
                      Phase {idx + 1} title
                      <input
                        value={p.title}
                        onChange={(e) => updatePhase(idx, { title: e.target.value })}
                        placeholder="e.g. First Cipher"
                        className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
                      />
                    </label>
                    <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
                      Unlocks
                      <input
                        type="datetime-local"
                        value={p.unlockAt}
                        onChange={(e) => updatePhase(idx, { unlockAt: e.target.value })}
                        className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
                      />
                    </label>
                    <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
                      Blurb
                      <input
                        value={p.blurb}
                        onChange={(e) => updatePhase(idx, { blurb: e.target.value })}
                        placeholder="What unlocks for the fleet in this phase?"
                        className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removePhase(idx)}
                      disabled={phases.length <= 1}
                      aria-label={`Remove phase ${idx + 1}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[color:var(--uf-border)] text-uf-muted hover:text-uf-text disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addPhase}
                className="mt-3 inline-flex items-center gap-1 text-xs text-uf-cyan hover:underline cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add phase
              </button>
            </fieldset>

            <div className="md:col-span-2 flex items-center justify-end">
              <NeonButton
                type="submit"
                variant="primary"
                loading={creating}
                disabled={!title.trim() || !tagline.trim()}
              >
                <RadioTower className="h-4 w-4 mr-1" aria-hidden /> Launch season
              </NeonButton>
            </div>
          </form>
        </HoloCard>

        <h2 className="uf-eyebrow mb-3">
          Campaigns ({campaigns === undefined ? "…" : campaigns.length})
        </h2>
        {campaigns === undefined ? (
          <div className="uf-skeleton" style={{ height: 120 }} />
        ) : campaigns.length === 0 ? (
          <div className="uf-empty">
            No campaigns yet. Launch Season 1 above and the Vault gets its
            first timeline.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {campaigns.map((c) => (
              <HoloCard key={c._id} className="!p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill variant="gold">Season {c.season}</StatusPill>
                      <StatusPill variant={c.status === "active" ? "success" : c.status === "upcoming" ? "warning" : "default"}>
                        {c.status}
                      </StatusPill>
                      <span className="text-uf-muted text-xs">
                        {new Date(c.startsAt).toLocaleString()} → {new Date(c.endsAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mt-2">{c.title}</h3>
                    <p className="text-uf-muted text-sm mt-1">{c.tagline}</p>
                    <p className="text-uf-muted text-xs mt-2">
                      {c.phases.length} phases · next unlock:{" "}
                      {c.phases.find((p) => p.status === "locked")?.title ?? "none remaining"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {(["upcoming", "active", "concluded"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="uf-btn uf-btn--ghost text-xs"
                        disabled={busy === `status-${c._id}` || c.status === s}
                        onClick={() => void handleStatus(c._id, s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </HoloCard>
            ))}
          </div>
        )}
      </div>
    </OperatorShell>
  );
}