import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";
import { NeonButton, StatusPill } from "@/components/uf";
import { getShipMissionsForClass } from "@/lib/ships";

const DIFFICULTY_VARIANT: Record<string, "info" | "success" | "warning" | "default"> = {
  Recruit: "info",
  Standard: "success",
  Elite: "warning",
  Flagship: "default",
};

// ---------------------------------------------------------------------------
// Ship missions — missions themed to the pilot's assigned hull class. These
// are cosmetic-progression runs (XP + Star Credits, no gameplay mechanics),
// generated deterministically from the class catalog. Progress is stored per
// class, so switching ships never resets another class's record.
// ---------------------------------------------------------------------------

export function ShipMissions({
  shipClass,
  completed = [],
  compact = false,
  className,
}: {
  shipClass?: string | null;
  completed?: string[];
  compact?: boolean;
  className?: string;
}) {
  const complete = useMutation(api.ships.completeShipMission);
  const [busy, setBusy] = useState<string | null>(null);
  const missions = getShipMissionsForClass(shipClass);
  if (missions.length === 0) return null;

  const handleComplete = async (missionId: string) => {
    setBusy(missionId);
    try {
      const res = await complete({ missionId });
      toast.success(`Mission logged — ${res.xp} XP, ${res.credits} Star Credits.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't log the mission.");
    } finally {
      setBusy(null);
    }
  };

  const doneCount = missions.filter((m) => completed.includes(m.id)).length;

  return (
    <div className={className}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="uf-eyebrow">Ship missions · {shipClass}</span>
        <StatusPill variant={doneCount === missions.length ? "success" : "info"}>
          {doneCount}/{missions.length} logged
        </StatusPill>
      </header>
      <ul className="mt-3 list-none p-0 m-0 space-y-2">
        {missions.map((m) => {
          const isDone = completed.includes(m.id);
          return (
            <li
              key={m.id}
              className={
                "rounded-md border p-3 " +
                (isDone
                  ? "border-[rgba(45,255,136,0.3)] bg-[rgba(45,255,136,0.05)]"
                  : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.45)]")
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-uf-text flex items-center gap-2">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-uf-green shrink-0" aria-hidden />
                    ) : null}
                    {m.title}
                  </p>
                  <p className="text-[11px] text-uf-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <StatusPill variant={DIFFICULTY_VARIANT[m.difficulty]}>
                      {m.difficulty}
                    </StatusPill>
                    <span>+{m.xp} XP</span>
                    <span>+{m.credits} cr</span>
                    {m.tags.map((t) => (
                      <span key={t} className="text-uf-cyan/80">
                        #{t}
                      </span>
                    ))}
                  </p>
                </div>
                {!isDone ? (
                  <NeonButton
                    variant={compact ? "ghost" : "primary"}
                    className={compact ? "text-xs px-2.5 py-1.5" : undefined}
                    disabled={busy === m.id}
                    onClick={() => void handleComplete(m.id)}
                  >
                    {busy === m.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      "Log run"
                    )}
                  </NeonButton>
                ) : (
                  <span className="text-[11px] uppercase tracking-[0.16em] text-uf-green">
                    On record
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}