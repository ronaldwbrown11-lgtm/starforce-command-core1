import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, StatusPill } from "@/components/uf";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BarChart3,
  Radio,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

const CYAN = "var(--uf-cyan, #00e5ff)";
const VIOLET = "var(--uf-violet, #a855f7)";
const GOLD = "var(--uf-gold, #f59e0b)";
const GREEN = "var(--uf-green, #22c55e)";

export default function OperatorAnalytics() {
  const [days, setDays] = useState(30);
  const ts = useQuery(api.admin.analyticsTimeSeries, { days });
  const summary = useQuery(api.operator.analyticsSummary);

  const stats = useMemo(() => {
    if (!ts || !summary) return null;
    const totalStories = ts.storySubmissions.reduce((s, d) => s + d.count, 0);
    const totalMod = ts.moderationActions.reduce((s, d) => s + d.count, 0);
    const totalBroadcast = ts.broadcastReach.reduce((s, d) => s + d.count, 0);
    const avgActive =
      ts.activeUsers.length > 0
        ? Math.round(
            ts.activeUsers.reduce((s, d) => s + d.count, 0) /
              ts.activeUsers.length,
          )
        : 0;
    return { totalStories, totalMod, totalBroadcast, avgActive, summary };
  }, [ts, summary]);

  const chartConfig = useMemo(
    () => ({
      count: { label: "Count", color: CYAN },
      stories: { label: "Stories", color: CYAN },
      users: { label: "Users", color: VIOLET },
      mod: { label: "Mod Actions", color: GOLD },
      reach: { label: "Reach", color: GREEN },
    }),
    [],
  );

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2">Analytics</h1>
        <p className="text-uf-muted text-sm mt-1">
          Time-series from the audit log and session telemetry. Refreshes live.
        </p>
      </header>

      {/* Summary strip */}
      <section className="uf-grid uf-grid--3 mb-8">
        {stats && (
          <>
            <HoloCard>
              <span className="uf-eyebrow">Stories ({days}d)</span>
              <p className="text-3xl font-semibold mt-2">
                {stats.totalStories}
              </p>
              <StatusPill variant="info" className="mt-3">
                {stats.summary.pendingStories} pending
              </StatusPill>
            </HoloCard>
            <HoloCard>
              <span className="uf-eyebrow">Avg Daily Active</span>
              <p className="text-3xl font-semibold mt-2">{stats.avgActive}</p>
              <StatusPill variant="info" className="mt-3">
                {stats.summary.totalUsers} total
              </StatusPill>
            </HoloCard>
            <HoloCard>
              <span className="uf-eyebrow">Broadcast Reach</span>
              <p className="text-3xl font-semibold mt-2">
                {stats.totalBroadcast.toLocaleString()}
              </p>
              <StatusPill variant="info" className="mt-3">
                {stats.totalMod} mod actions
              </StatusPill>
            </HoloCard>
          </>
        )}
        {!stats && (
          <>
            {[1, 2, 3].map((i) => (
              <HoloCard key={i}>
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-16 rounded bg-[rgba(0,229,255,0.1)]" />
                  <div className="h-8 w-20 rounded bg-[rgba(0,229,255,0.08)]" />
                </div>
              </HoloCard>
            ))}
          </>
        )}
      </section>

      {/* Range selector */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-uf-muted uppercase tracking-wider">
          Range:
        </span>
        {[7, 14, 30, 60].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`px-3 py-1 rounded text-xs border transition-colors ${
              days === d
                ? "border-[var(--uf-cyan)] bg-[rgba(0,229,255,0.12)] text-uf-text"
                : "border-[var(--uf-border)] text-uf-muted hover:border-[rgba(0,229,255,0.3)]"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* Charts grid */}
      {ts && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Story Submissions — Area */}
          <HoloCard>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-[var(--uf-cyan)]" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Story Submissions
              </h2>
            </div>
            <div className="-ml-4 mr-2">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={ts.storySubmissions}>
                  <defs>
                    <linearGradient id="storyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CYAN} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--uf-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--uf-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--uf-bg-card, #0a0f1a)",
                      border: "1px solid var(--uf-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--uf-muted)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={CYAN}
                    strokeWidth={2}
                    fill="url(#storyGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: CYAN }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </HoloCard>

          {/* Active Users — Bar */}
          <HoloCard>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-[var(--uf-violet)]" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Active Users
              </h2>
            </div>
            <div className="-ml-4 mr-2">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ts.activeUsers}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--uf-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--uf-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--uf-bg-card, #0a0f1a)",
                      border: "1px solid var(--uf-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--uf-muted)" }}
                  />
                  <Bar
                    dataKey="count"
                    fill={VIOLET}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </HoloCard>

          {/* Moderation Throughput — Line */}
          <HoloCard>
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-4 w-4 text-[var(--uf-gold)]" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Moderation Throughput
              </h2>
            </div>
            <div className="-ml-4 mr-2">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={ts.moderationActions}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--uf-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--uf-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--uf-bg-card, #0a0f1a)",
                      border: "1px solid var(--uf-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--uf-muted)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={GOLD}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: GOLD }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </HoloCard>

          {/* Broadcast Reach — Bar */}
          <HoloCard>
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-4 w-4 text-[var(--uf-green)]" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Broadcast Reach
              </h2>
            </div>
            <div className="-ml-4 mr-2">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ts.broadcastReach}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.06)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--uf-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--uf-muted)" }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--uf-bg-card, #0a0f1a)",
                      border: "1px solid var(--uf-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--uf-muted)" }}
                  />
                  <Bar
                    dataKey="count"
                    fill={GREEN}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </HoloCard>
        </section>
      )}

      {/* Empty / loading fallback */}
      {!ts && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <HoloCard key={i}>
              <div className="animate-pulse space-y-4">
                <div className="h-4 w-32 rounded bg-[rgba(0,229,255,0.1)]" />
                <div className="h-[200px] rounded bg-[rgba(0,229,255,0.04)]" />
              </div>
            </HoloCard>
          ))}
        </section>
      )}
    </OperatorShell>
  );
}
