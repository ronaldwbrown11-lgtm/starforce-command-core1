import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard, NeonButton, StatusPill } from "../uf";
import {
  formatPercent,
  getAiCap,
  getStorageCap,
  parseOverageError,
  type OveragePayload,
  type TierId,
} from "@/lib/tiers";
import { toast } from "sonner";
import { OverageConfirmDialog } from "./OverageConfirmDialog";

type Mode = "self" | "operator-self" | "operator-other";

export function TierUsageWidget({
  userId,
  mode,
  initialTier,
}: {
  userId?: string;
  mode?: Mode;
  initialTier?: TierId;
}) {
  const usage = useQuery(api.usage.userUsage, userId ? { userId: userId as any } : {});
  const consume = useMutation(api.usage.consumeAi);
  const setUsage = useMutation(api.usage.setUsage);

  const [pending, setPending] = useState(false);
  const [overage, setOverage] = useState<OveragePayload | null>(null);
  const [open, setOpen] = useState(false);

  const tier: TierId =
    (usage?.tier as TierId | undefined) ?? initialTier ?? "free";
  const aiCap = getAiCap(tier);
  const storageCap = getStorageCap(tier);
  const aiUsed = usage?.ai.used ?? 0;
  const storageUsed = usage?.storage.usedGb ?? 0;
  const aiPercent = usage?.ai.percent ?? formatPercent(aiUsed, aiCap);
  const storagePercent =
    usage?.storage.percent ?? formatPercent(storageUsed, storageCap);
  const overAi = aiPercent >= 100;
  const overStorage = storagePercent >= 100;

  async function fireOneGeneration(confirm: boolean) {
    setPending(true);
    try {
      await consume({ count: 1, confirmOverage: confirm });
      toast.success(
        confirm
          ? "Overage confirmed. Generation recorded."
          : "Generation recorded.",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed.";
      const parsed = parseOverageError(msg);
      if (parsed && !confirm) {
        setOverage(parsed);
        setOpen(true);
      } else {
        toast.error("Failed to consume AI generation.");
      }
    } finally {
      setPending(false);
    }
  }

  const canOverride = mode === "operator-self" || mode === "operator-other";

  return (
    <section
      aria-labelledby="uf-usage-heading"
      className="uf-panel p-5"
      data-uf-widget="tier-usage"
    >
      <header className="flex items-center justify-between mb-3">
        <h3 id="uf-usage-heading" className="uf-eyebrow">Tier usage</h3>
        <StatusPill
          variant={
            overAi || overStorage
              ? "danger"
              : aiPercent >= 80 || storagePercent >= 80
                ? "warning"
                : "success"
          }
        >
          {overAi || overStorage
            ? "Overage"
            : aiPercent >= 80 || storagePercent >= 80
              ? "Approaching cap"
              : "Healthy"}
        </StatusPill>
      </header>

      {!usage ? (
        <>
          <div className="uf-skeleton" style={{ height: 28 }} />
          <div className="uf-skeleton mt-3" style={{ height: 28 }} />
        </>
      ) : (
        <>
          <UsageRow
            label="AI generations"
            used={aiUsed}
            cap={aiCap}
            percent={aiPercent}
            suffix=" / month"
          />
          <UsageRow
            label="Storage"
            used={storageUsed}
            cap={storageCap}
            percent={storagePercent}
            suffix=" GB"
          />
          <p className="text-uf-muted text-xs mt-3" aria-live="polite">
            Period: {new Date(usage.periodStart).toLocaleDateString()} —{" "}
            {new Date(usage.periodEnd).toLocaleDateString()}
          </p>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <NeonButton
          variant="primary"
          loading={pending}
          disabled={pending}
          onClick={() => fireOneGeneration(false)}
          aria-label="Record one AI generation against your tier cap"
        >
          Generate one (test meter)
        </NeonButton>
        {canOverride && userId && (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              placeholder="AI used"
              className="border border-[color:var(--uf-border)] rounded-md px-2 py-1 text-xs bg-[rgba(16,24,39,0.5)] w-20"
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                const target = e.currentTarget;
                const v = parseInt(target.value, 10);
                if (Number.isNaN(v)) return;
                try {
                  await setUsage({ userId: userId as any, monthlyAiUsed: v });
                  toast.success("AI used override applied.");
                  target.value = "";
                } catch {
                  toast.error("Failed to override.");
                }
              }}
            />
            <input
              type="number"
              min={0}
              step={0.1}
              placeholder="Storage GB"
              className="border border-[color:var(--uf-border)] rounded-md px-2 py-1 text-xs bg-[rgba(16,24,39,0.5)] w-24"
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return;
                const target = e.currentTarget;
                const v = parseFloat(target.value);
                if (Number.isNaN(v)) return;
                try {
                  await setUsage({ userId: userId as any, storageUsedGb: v });
                  toast.success("Storage override applied.");
                  target.value = "";
                } catch {
                  toast.error("Failed to override.");
                }
              }}
            />
          </div>
        )}
      </div>

      <OverageConfirmDialog
        payload={overage}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setOverage(null);
        }}
        onConfirm={() => {
          setOpen(false);
          setOverage(null);
          // Replay the consume call with confirmOverage=true; don't await here so the dialog closes.
          void fireOneGeneration(true);
        }}
        confirming={pending}
      />
    </section>
  );
}

function UsageRow({
  label,
  used,
  cap,
  percent,
  suffix,
}: {
  label: string;
  used: number;
  cap: number;
  percent: number;
  suffix?: string;
}) {
  const clampedPct = Math.max(0, Math.min(100, percent));
  return (
    <div className="mb-3">
      <div className="flex items-baseline justify-between">
        <span className="uf-eyebrow text-uf-muted">{label}</span>
        <span className="text-sm font-medium">
          {used.toLocaleString()}
          <span className="text-uf-muted">{suffix ?? ""}</span>{" "}
          <span className="text-uf-muted text-xs">/ {cap.toLocaleString()}</span>
        </span>
      </div>
      <div
        className="uf-progress mt-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedPct}
        aria-label={`${label}: ${used} of ${cap} (${percent}%)`}
      >
        <div
          className="uf-progress__bar"
          style={{
            width: `${clampedPct}%`,
            background:
              percent >= 100
                ? "linear-gradient(90deg, var(--uf-red), var(--uf-magenta))"
                : percent >= 80
                  ? "linear-gradient(90deg, var(--uf-gold), var(--uf-magenta))"
                  : undefined,
            boxShadow:
              percent >= 100
                ? "var(--uf-glow-danger)"
                : percent >= 80
                  ? "var(--uf-glow-violet)"
                  : undefined,
          }}
        />
      </div>
    </div>
  );
}
