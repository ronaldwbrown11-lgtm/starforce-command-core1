import { useState, type FormEvent } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import { Archive, KeyRound, Link2, Sparkles, Wand2 } from "lucide-react";

const TIER_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "cadet", label: "Cadet+" },
  { value: "officer", label: "Officer+" },
  { value: "command", label: "Command+" },
  { value: "elite", label: "Elite+" },
  { value: "gia_agent", label: "G.I.A Agent+" },
];

type Draft = {
  title: string;
  ciphertext: string;
  hint: string;
  answer: string;
  rewardXp: number;
  rewardCredits: number;
  tierRequired: string | null;
};

const emptyDraft: Draft = {
  title: "",
  ciphertext: "",
  hint: "",
  answer: "",
  rewardXp: 20,
  rewardCredits: 15,
  tierRequired: null,
};

function DraftFields({
  d,
  onChange,
}: {
  d: Draft;
  onChange: (patch: Partial<Draft>) => void;
}) {
  const inputCls =
    "border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1 sm:col-span-2">
        Title
        <input value={d.title} onChange={(e) => onChange({ title: e.target.value })} className={inputCls} />
      </label>
      <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
        Ciphertext (the scrambled transmission)
        <textarea
          value={d.ciphertext}
          onChange={(e) => onChange({ ciphertext: e.target.value })}
          rows={3}
          className={inputCls + " font-mono"}
        />
      </label>
      <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
        Hint (how to crack it)
        <textarea
          value={d.hint}
          onChange={(e) => onChange({ hint: e.target.value })}
          rows={3}
          className={inputCls}
        />
      </label>
      <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
        Answer (decrypted plaintext)
        <input value={d.answer} onChange={(e) => onChange({ answer: e.target.value })} className={inputCls + " font-mono"} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
          XP
          <input
            type="number"
            min={5}
            value={d.rewardXp}
            onChange={(e) => onChange({ rewardXp: Number(e.target.value) })}
            className={inputCls}
          />
        </label>
        <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
          Credits
          <input
            type="number"
            min={5}
            value={d.rewardCredits}
            onChange={(e) => onChange({ rewardCredits: Number(e.target.value) })}
            className={inputCls}
          />
        </label>
        <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
          Tier
          <select
            value={d.tierRequired ?? ""}
            onChange={(e) => onChange({ tierRequired: e.target.value || null })}
            className={inputCls}
          >
            {TIER_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export default function OpSignals() {
  const signals = useQuery(api.signals.listSignalsForOperator);
  const campaigns = useQuery(api.arg.listArgCampaigns);
  const createSignal = useMutation(api.signals.createSignal);
  const createForCampaign = useMutation(api.signals.createSignalsForCampaign);
  const archiveSignal = useMutation(api.signals.archiveSignal);
  const forge = useAction(api.signalForge.generateSignalDrafts);

  // --- Manual create ---
  const [manual, setManual] = useState<Draft>(emptyDraft);
  const [creating, setCreating] = useState(false);

  // --- AI forge ---
  const [forgeCount, setForgeCount] = useState(4);
  const [theme, setTheme] = useState("");
  const [forging, setForging] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  // --- Batch attach to campaign ---
  const [campaignId, setCampaignId] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeCampaigns = (campaigns ?? []).filter((c) => c.status !== "concluded");

  const handleForge = async () => {
    setForging(true);
    try {
      const res = await forge({
        count: forgeCount,
        theme: theme || undefined,
        campaignSeason: undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDrafts(res.drafts);
      toast.success(`Forged ${res.drafts.length} draft${res.drafts.length === 1 ? "" : "s"} — review, then save.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Forge failed.");
    } finally {
      setForging(false);
    }
  };

  const saveDraft = async (d: Draft, idx: number) => {
    setBusyId(`draft-${idx}`);
    try {
      await createSignal({
        title: d.title,
        ciphertext: d.ciphertext,
        hint: d.hint,
        plaintext: d.answer,
        rewardXp: d.rewardXp,
        rewardCredits: d.rewardCredits,
        tierRequired: d.tierRequired ?? undefined,
      });
      setDrafts((prev) => prev.filter((_, i) => i !== idx));
      toast.success(`"${d.title}" is live in the Vault.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusyId(null);
    }
  };

  const handleManualCreate = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createSignal({
        title: manual.title,
        ciphertext: manual.ciphertext,
        hint: manual.hint,
        plaintext: manual.answer,
        rewardXp: manual.rewardXp,
        rewardCredits: manual.rewardCredits,
        tierRequired: manual.tierRequired ?? undefined,
      });
      toast.success("Signal created.");
      setManual(emptyDraft);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setCreating(false);
    }
  };

  const handleAttach = async () => {
    if (!campaignId) return;
    setAttaching(true);
    try {
      const res = await createForCampaign({
        campaignId: campaignId as never,
        drafts: drafts.map((d) => ({
          title: d.title,
          ciphertext: d.ciphertext,
          hint: d.hint,
          answer: d.answer,
          rewardXp: d.rewardXp,
          rewardCredits: d.rewardCredits,
          tierRequired: d.tierRequired ?? undefined,
        })),
      });
      toast.success(`${res.count} signal${res.count === 1 ? "" : "s"} attached to the campaign.`);
      setDrafts([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Attach failed.");
    } finally {
      setAttaching(false);
    }
  };

  const handleArchive = async (id: string) => {
    setBusyId(`arch-${id}`);
    try {
      await archiveSignal({ id: id as never });
      toast.success("Signal archived — it no longer appears in the Vault.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed.");
    } finally {
      setBusyId(null);
    }
  };

  const inputCls =
    "border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] text-uf-text";

  return (
    <OperatorShell>
      <div className="p-6 max-w-5xl">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Signal Vault</h1>
        <p className="text-uf-muted text-sm mb-6">
          Forge intercepted transmissions for the fleet to decrypt. Signals can
          be AI-forged (review before saving), written by hand, or batch-attached
          to an ARG season so the Vault populates when the campaign launches.
        </p>

        {/* ============ AI FORGE ============ */}
        <HoloCard accent="violet" className="mb-6">
          <h2 className="uf-eyebrow mb-1 flex items-center gap-1.5">
            <Wand2 className="h-3.5 w-3.5" aria-hidden /> AI signal forge
          </h2>
          <p className="text-uf-muted text-xs mb-3">
            Drafts solvable cipher puzzles (Caesar, Atbash, A1Z26, reversed…).
            Nothing goes live until you save a draft.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
              How many
              <select
                value={forgeCount}
                onChange={(e) => setForgeCount(Number(e.target.value))}
                className={inputCls}
              >
                {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1 flex-1 min-w-[220px]">
              Season theme (optional)
              <input
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="e.g. The Nine-Minute Signal — transmissions from the Outer Belt"
                className={inputCls}
              />
            </label>
            <NeonButton variant="primary" loading={forging} onClick={handleForge}>
              <Sparkles className="h-4 w-4 mr-1" aria-hidden /> Forge drafts
            </NeonButton>
          </div>

          {drafts.length > 0 && (
            <div className="mt-5 flex flex-col gap-4">
              {campaigns !== undefined && activeCampaigns.length > 0 && (
                <div className="flex flex-wrap items-end gap-3 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.3)] p-3">
                  <label className="text-[11px] uppercase tracking-[0.12em] text-uf-muted flex flex-col gap-1">
                    Attach all {drafts.length} drafts to campaign
                    <select
                      value={campaignId}
                      onChange={(e) => setCampaignId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">— pick a season —</option>
                      {activeCampaigns.map((c) => (
                        <option key={c._id} value={c._id}>
                          Season {c.season} — {c.title} ({c.status})
                        </option>
                      ))}
                    </select>
                  </label>
                  <NeonButton
                    variant="violet"
                    loading={attaching}
                    disabled={!campaignId}
                    onClick={handleAttach}
                  >
                    <Link2 className="h-4 w-4 mr-1" aria-hidden /> Attach batch
                  </NeonButton>
                </div>
              )}

              {drafts.map((d, idx) => (
                <div key={idx} className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.3)] p-3">
                  <DraftFields d={d} onChange={(patch) => setDrafts((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))} />
                  <div className="mt-3 flex justify-end">
                    <NeonButton
                      variant="ghost"
                      loading={busyId === `draft-${idx}`}
                      disabled={!d.title.trim() || !d.ciphertext.trim() || !d.hint.trim() || !d.answer.trim()}
                      onClick={() => void saveDraft(d, idx)}
                    >
                      <KeyRound className="h-4 w-4 mr-1" aria-hidden /> Save to Vault
                    </NeonButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </HoloCard>

        {/* ============ MANUAL CREATE ============ */}
        <HoloCard className="mb-8">
          <h2 className="uf-eyebrow mb-3 flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" aria-hidden /> Create a signal by hand
          </h2>
          <form onSubmit={handleManualCreate}>
            <DraftFields d={manual} onChange={(patch) => setManual((p) => ({ ...p, ...patch }))} />
            <div className="mt-4 flex justify-end">
              <NeonButton
                type="submit"
                variant="primary"
                loading={creating}
                disabled={!manual.title.trim() || !manual.ciphertext.trim() || !manual.hint.trim() || !manual.answer.trim()}
              >
                Create signal
              </NeonButton>
            </div>
          </form>
        </HoloCard>

        {/* ============ EXISTING SIGNALS ============ */}
        <h2 className="uf-eyebrow mb-3">
          All signals ({signals === undefined ? "…" : signals.length})
        </h2>
        {signals === undefined ? (
          <div className="uf-skeleton" style={{ height: 120 }} />
        ) : signals.length === 0 ? (
          <div className="uf-empty">No signals yet — forge a batch above.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {signals.map((s) => (
              <HoloCard key={s._id} className="!p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill variant={s.active ? "success" : "default"}>
                        {s.active ? "active" : "archived"}
                      </StatusPill>
                      {s.campaignName ? (
                        <StatusPill variant="violet">{s.campaignName}</StatusPill>
                      ) : null}
                      {s.tierRequired ? (
                        <StatusPill variant="warning">{s.tierRequired}+</StatusPill>
                      ) : null}
                      <span className="text-uf-muted text-xs">
                        {s.rewardXp} XP · {s.rewardCredits} cr · solved by {s.solvedCount}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold mt-1.5">{s.title}</h3>
                    <p className="font-mono text-xs text-uf-muted mt-0.5 truncate">
                      {s.ciphertext} → <span className="text-uf-text">{s.answer}</span>
                    </p>
                  </div>
                  {s.active ? (
                    <button
                      type="button"
                      className="uf-btn uf-btn--ghost text-xs shrink-0"
                      disabled={busyId === `arch-${s._id}`}
                      onClick={() => void handleArchive(s._id)}
                    >
                      <Archive className="h-3.5 w-3.5 mr-1" aria-hidden /> Archive
                    </button>
                  ) : null}
                </div>
              </HoloCard>
            ))}
          </div>
        )}
      </div>
    </OperatorShell>
  );
}
