import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { usePageMeta } from "@/hooks/use-page-meta";
import { toast } from "sonner";
import { RadioTower, Lock, Unlock, Coins, Zap } from "lucide-react";

export default function SignalVault() {
  const { isAuthenticated } = useAuth();
  const signals = useQuery(api.signals.listSignals);
  const solve = useMutation(api.signals.solveSignal);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  usePageMeta({
    title: "Signal Vault — Star Force 1198",
    description:
      "Intercepted Ultra Force ciphers. Decrypt them to earn Star Credits and XP.",
  });

  async function handleSolve(e: FormEvent, signalId: Id<"signals">) {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error("Sign in to decrypt signals.");
      return;
    }
    const answer = answers[signalId] ?? "";
    if (!answer.trim()) return;
    setBusy(signalId);
    try {
      const res = await solve({ signalId, answer });
      if (res.solved && res.alreadySolved) {
        toast.info(res.message);
      } else if (res.solved) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transmission error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow="Signal Intelligence"
        title="The Signal Vault"
        lead="The fleet has intercepted encrypted Ultra Force transmissions drifting out of the temporal rift. Crack the ciphers to claim Star Credits, XP, and a place in the decryption log."
        primary={
          isAuthenticated
            ? undefined
            : { label: "Sign in to decrypt", href: "/auth", variant: "primary" }
        }
      />
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        {signals === undefined ? (
          <div className="uf-grid uf-grid--2">
            {[0, 1].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 200 }} />
            ))}
          </div>
        ) : signals.length === 0 ? (
          <div className="uf-empty">
            No active signals. The rift is quiet — check back after the next
            fleet broadcast.
          </div>
        ) : (
          <ul className="uf-grid uf-grid--2 list-none p-0 m-0">
            {signals.map((s) => {
              const isBusy = busy === s._id;
              return (
                <li key={s._id}>
                  <HoloCard className="flex flex-col gap-3 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <RadioTower
                          className="h-4 w-4 text-[var(--uf-cyan)]"
                          aria-hidden
                        />
                        <h3 className="text-base font-semibold">{s.title}</h3>
                      </div>
                      {s.solved ? (
                        <StatusPill variant="success">Decoded</StatusPill>
                      ) : (
                        <StatusPill variant="warning">Encrypted</StatusPill>
                      )}
                    </div>

                    <pre
                      className="whitespace-pre-wrap font-mono text-xs leading-relaxed rounded-md border border-[color:var(--uf-border)] bg-[rgba(4,9,18,0.85)] p-3 text-[var(--uf-cyan)] break-words"
                      aria-label={`Ciphertext for ${s.title}`}
                    >
                      {s.ciphertext}
                    </pre>

                    <p className="text-uf-muted text-xs">
                      <span className="text-[var(--uf-violet)] font-semibold uppercase tracking-wider text-[10px]">
                        Intel hint:{" "}
                      </span>
                      {s.hint}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-uf-muted">
                      <span className="inline-flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5 text-[var(--uf-cyan)]" aria-hidden />
                        {s.rewardXp} XP
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Coins
                          className="h-3.5 w-3.5"
                          style={{ color: "var(--uf-gold)" }}
                          aria-hidden
                        />
                        {s.rewardCredits} credits
                      </span>
                    </div>

                    {s.solved ? (
                      <p className="text-xs text-[var(--uf-green)] flex items-center gap-1.5">
                        <Unlock className="h-3.5 w-3.5" aria-hidden />
                        Decrypted and archived to your service record.
                      </p>
                    ) : (
                      <form
                        onSubmit={(e) => handleSolve(e, s._id)}
                        className="flex gap-2"
                        aria-label={`Decrypt ${s.title}`}
                      >
                        <label className="sr-only" htmlFor={`answer-${s._id}`}>
                          Decrypted answer for {s.title}
                        </label>
                        <input
                          id={`answer-${s._id}`}
                          value={answers[s._id] ?? ""}
                          onChange={(e) =>
                            setAnswers((a) => ({ ...a, [s._id]: e.target.value }))
                          }
                          placeholder="Enter decrypted answer…"
                          autoComplete="off"
                          className="flex-1 min-w-0 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] px-3 py-2 text-sm"
                        />
                        <NeonButton
                          type="submit"
                          variant="ghost"
                          className="shrink-0"
                          loading={isBusy}
                        >
                          <Lock className="h-3.5 w-3.5 mr-1" aria-hidden />
                          Decrypt
                        </NeonButton>
                      </form>
                    )}
                  </HoloCard>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-uf-muted text-xs mt-8 max-w-[720px]">
          New signals are released with fleet broadcasts. Rewards pay out once
          per member — decoded answers are logged to your service record and
          the audit trail.
        </p>
      </section>
    </SiteShell>
  );
}
