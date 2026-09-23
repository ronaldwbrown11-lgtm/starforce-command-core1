import { useQuery } from "convex/react";
import { useState } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, StatusPill } from "@/components/uf";
import { api } from "@/convex/_generated/api";
import { Coins, Loader2 } from "lucide-react";

// =========================================================================
// Operator console — AI Spend.
//
// Real provider costs from the aiCostLogs ledger: rolling totals, daily
// burn series, top members by cost, and the raw call feed. Dollar figures
// come from provider-reported token usage at known per-model rates.
// =========================================================================

const usd = (n: number) =>
  n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;

const SURFACE_LABEL: Record<string, string> = {
  lore_assistant: "Lore Assistant",
  canon_scanner: "Canon Scanner",
};

function Spark({ points }: { points: { day: string; costUsd: number }[] }) {
  const max = Math.max(...points.map((p) => p.costUsd), 0.000001);
  return (
    <div className="flex items-end gap-[2px] h-16" aria-hidden>
      {points.map((p) => (
        <div
          key={p.day}
          className="flex-1 min-w-[3px] rounded-t"
          style={{
            height: `${Math.max(2, (p.costUsd / max) * 100)}%`,
            background:
              p.costUsd > 0
                ? "linear-gradient(180deg, var(--uf-cyan), rgba(0,229,255,0.15))"
                : "rgba(255,255,255,0.06)",
          }}
          title={`${p.day}: ${usd(p.costUsd)}`}
        />
      ))}
    </div>
  );
}

export default function OperatorAiSpend() {
  const summary = useQuery(api.aiSpend.spendSummary, {});
  const series = useQuery(api.aiSpend.spendDailySeries, { days: 30 });
  const members = useQuery(api.aiSpend.spendByMember, { days: 30, limit: 15 });
  const recent = useQuery(api.aiSpend.spendRecentCalls, { limit: 50 });
  const [windowDays, setWindowDays] = useState(30);

  const active = summary?.windows.find((w) => w.days === windowDays);

  return (
    <OperatorShell>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-uf-text flex items-center gap-2">
            <Coins className="h-6 w-6 text-uf-cyan" aria-hidden /> AI Spend
          </h1>
          <p className="text-sm text-uf-muted mt-1">
            Real provider cost of every AI call, from token usage in each response.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-[color:var(--uf-border)] p-1">
          {[1, 7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`px-3 py-1 text-xs rounded cursor-pointer ${
                windowDays === d
                  ? "bg-[rgba(0,229,255,0.15)] text-uf-cyan"
                  : "text-uf-muted hover:text-uf-text"
              }`}
            >
              {d === 1 ? "24h" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {summary === undefined ? (
        <div className="flex items-center gap-2 text-uf-muted text-sm p-8">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading ledger…
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Totals strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <HoloCard>
              <p className="uf-eyebrow">Total cost</p>
              <p className="text-3xl font-bold tracking-tight text-uf-text mt-1">
                {usd(active?.costUsd ?? 0)}
              </p>
              <p className="text-xs text-uf-muted mt-1">
                {active?.calls ?? 0} calls in the last {windowDays === 1 ? "24 hours" : `${windowDays} days`}
              </p>
            </HoloCard>
            <HoloCard>
              <p className="uf-eyebrow">Avg per call</p>
              <p className="text-3xl font-bold tracking-tight text-uf-text mt-1">
                {usd(active?.avgCostUsd ?? 0)}
              </p>
              <p className="text-xs text-uf-muted mt-1">
                {(active?.inputTokens ?? 0).toLocaleString()} in / {(active?.outputTokens ?? 0).toLocaleString()} out tokens
              </p>
            </HoloCard>
            <HoloCard className="sm:col-span-2">
              <p className="uf-eyebrow">Cost by surface</p>
              {active && active.bySurface.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1.5 list-none p-0 m-0">
                  {active.bySurface.map((s) => (
                    <li key={s.surface} className="flex items-center justify-between text-sm">
                      <span className="text-uf-text">
                        {SURFACE_LABEL[s.surface] ?? s.surface}
                        <span className="text-uf-muted text-xs ml-2">{s.calls} calls</span>
                      </span>
                      <span className="font-medium text-uf-cyan">{usd(s.costUsd)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-uf-muted mt-2">No calls in this window.</p>
              )}
            </HoloCard>
          </div>

          {/* 30-day burn */}
          <HoloCard>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="uf-eyebrow">Daily burn — last 30 days</p>
              <span className="text-xs text-uf-muted">
                {series?.reduce((a, d) => a + d.calls, 0) ?? 0} calls ·{" "}
                {usd(series?.reduce((a, d) => a + d.costUsd, 0) ?? 0)} total
              </span>
            </div>
            <div className="mt-3">
              {series && series.length > 0 ? (
                <Spark points={series} />
              ) : (
                <p className="text-sm text-uf-muted">No data yet — the ledger fills as members use AI tools.</p>
              )}
            </div>
          </HoloCard>

          {/* Members + recent calls */}
          <div className="grid gap-6 lg:grid-cols-2">
            <HoloCard>
              <p className="uf-eyebrow">Top members by cost — 30d</p>
              {members && members.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0">
                  {members.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="text-uf-text block truncate">{m.displayName}</span>
                        <span className="text-uf-muted text-xs">
                          {m.tier} · {m.calls} calls · {m.surfaces.map((s) => SURFACE_LABEL[s] ?? s).join(", ")}
                        </span>
                      </span>
                      <span className="font-medium text-uf-cyan shrink-0">{usd(m.costUsd)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-uf-muted mt-3">
                  No member-attributed calls yet.
                </p>
              )}
            </HoloCard>

            <HoloCard>
              <p className="uf-eyebrow">Recent calls</p>
              {recent && recent.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2 list-none p-0 m-0 max-h-[420px] overflow-y-auto">
                  {recent.map((r) => (
                    <li
                      key={r._id}
                      className="flex items-center justify-between gap-3 text-sm border-b border-[color:var(--uf-border)] pb-2 last:border-0 last:pb-0"
                    >
                      <span className="min-w-0">
                        <span className="text-uf-text block truncate">
                          {SURFACE_LABEL[r.surface] ?? r.surface} · {r.who}
                        </span>
                        <span className="text-uf-muted text-xs">
                          {new Date(r.createdAt).toLocaleString()} · {r.inputTokens.toLocaleString()} in /{" "}
                          {r.outputTokens.toLocaleString()} out
                        </span>
                      </span>
                      <StatusPill variant="info">{usd(r.costUsd)}</StatusPill>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-uf-muted mt-3">
                  No calls logged yet. Run the Lore Assistant or submit a story to populate the ledger.
                </p>
              )}
            </HoloCard>
          </div>
        </div>
      )}
    </OperatorShell>
  );
}
