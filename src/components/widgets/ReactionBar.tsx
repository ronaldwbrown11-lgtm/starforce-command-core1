import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";

type ReactionKind = "transmit" | "salute" | "warn";

const REACTIONS: { kind: ReactionKind; icon: string; label: string }[] = [
  { kind: "transmit", icon: "◈", label: "Transmit" },
  { kind: "salute", icon: "▲", label: "Salute" },
  { kind: "warn", icon: "⚠", label: "Warn" },
];

/**
 * Story-level reaction bar (transmit / salute / warn).
 * Reads live counts + the signed-in user's own reactions, and toggles via
 * the existing social.toggleReaction mutation.
 */
export function ReactionBar({ targetId }: { targetId: string }) {
  const { isAuthenticated } = useAuth();
  const data = useQuery(api.social.storyReactions, { storyId: targetId });
  const react = useMutation(api.social.toggleReaction);
  const [pending, setPending] = useState<ReactionKind | null>(null);

  async function toggle(kind: ReactionKind) {
    if (!isAuthenticated) {
      toast.error("Sign in to react.");
      return;
    }
    setPending(kind);
    try {
      await react({ targetId, targetType: "story", kind });
    } catch {
      toast.error("Failed to register reaction.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-label="Story reactions"
      className="uf-panel p-4 flex items-center justify-between flex-wrap gap-3"
      data-uf-widget="reaction-bar"
    >
      <div className="flex items-center gap-2">
        <span className="uf-eyebrow">Fleet response</span>
        <span className="text-xs text-uf-muted" aria-live="polite">
          {data === undefined ? "…" : data.total}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {REACTIONS.map((r) => {
          const count = data?.counts[r.kind] ?? 0;
          const active = data?.mine[r.kind] ?? false;
          return (
            <button
              key={r.kind}
              type="button"
              onClick={() => toggle(r.kind)}
              disabled={pending === r.kind}
              aria-pressed={active}
              className={`uf-pill cursor-pointer transition-all ${
                active ? "shadow-[var(--uf-glow-cyan)] border-[color:var(--uf-cyan)]" : ""
              } ${pending === r.kind ? "opacity-60" : ""}`}
            >
              <span aria-hidden="true">{r.icon}</span> {r.label}
              <span className="ml-1 text-uf-muted">{count > 0 ? count : ""}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
