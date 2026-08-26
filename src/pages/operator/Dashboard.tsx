import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { VOICE } from "@/lib/voice";
import { EasterEggBadge } from "@/components/usage/EasterEggBadge";
import { NighthawkQueue } from "@/components/operator/NighthawkQueue";

export default function OperatorDashboard() {
  const health = useQuery(api.operator.systemHealth);
  const analytics = useQuery(api.operator.analyticsSummary);
  const moderation = useQuery(api.operator.moderationQueue, { limit: 5 });
  const stories = useQuery(api.operator.storyApprovalQueue, { limit: 5 });
  const STATS = [
    { label: "Users", value: analytics?.totalUsers },
    { label: "Stories", value: analytics?.totalStories },
    { label: "Comments", value: analytics?.totalComments },
    { label: "Pending", value: analytics?.pendingStories },
    { label: "Activity 24h", value: analytics?.activity24h },
    { label: "Stories 7d", value: analytics?.stories7d },
    { label: "Comments 7d", value: analytics?.comments7d },
  ];
  return (
    <OperatorShell>
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <span className="uf-eyebrow">{VOICE.operatorEyebrow}</span>
          <h1 className="text-3xl font-semibold mt-2">{VOICE.heroTitle}</h1>
          <p className="text-uf-muted text-sm mt-2 max-w-2xl">{VOICE.heroLead}</p>
        </div>
        <a href="/operator/audit" className="uf-btn uf-btn--ghost">Open audit log</a>
      </header>
      <section aria-label="Stats" className="uf-grid uf-grid--3 mb-6">
        {STATS.map((s) => (
          <HoloCard key={s.label}>
            <span className="uf-eyebrow">Stat</span>
            <p className="text-3xl font-semibold mt-2">{s.value ?? "—"}</p>
            <p className="text-uf-muted text-xs mt-1">{s.label}</p>
          </HoloCard>
        ))}
      </section>
      <section aria-label="Community studio" className="mb-6">
        <span className="uf-eyebrow">Community studio</span>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Events Calendar", href: "/operator/events", desc: "Schedule Lore Lab, faction meetings, and countdowns" },
            { label: "Captain's Log", href: "/operator/log", desc: "Post daily behind-the-scenes updates" },
            { label: "Changelog", href: "/operator/changelog", desc: "Release notes for the fleet" },
            { label: "Signal Vault", href: "/vault", desc: "Preview the ciphers members decrypt" },
          ].map((c) => (
            <a key={c.href} href={c.href} className="block h-full">
              <HoloCard className="h-full !p-4 transition-all hover:-translate-y-0.5">
                <p className="text-sm font-semibold text-uf-cyan">{c.label}</p>
                <p className="text-uf-muted text-xs mt-1">{c.desc}</p>
              </HoloCard>
            </a>
          ))}
        </div>
      </section>
      <section className="uf-grid uf-grid--2 mb-6">
        <HoloCard>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Moderation queue</h2>
            <a href="/operator/moderation" className="uf-btn uf-btn--ghost">Open</a>
          </header>
          {moderation === undefined ? (
            <div className="uf-skeleton" style={{ height: 96 }} />
          ) : moderation.length === 0 ? (
            <p className="text-uf-muted text-sm">Queue is clear.</p>
          ) : (
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {moderation.map((m) => (
                <li key={m._id} className="flex items-center justify-between text-sm">
                  <span>
                    {m.targetType} — {m.reason ?? "no reason"}
                  </span>
                  <StatusPill variant="warning">{m.status}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>
        <HoloCard>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Story approvals</h2>
            <a href="/operator/stories" className="uf-btn uf-btn--ghost">Open</a>
          </header>
          {stories === undefined ? (
            <div className="uf-skeleton" style={{ height: 96 }} />
          ) : stories.length === 0 ? (
            <p className="text-uf-muted text-sm">No pending stories.</p>
          ) : (
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {stories.map((s) => (
                <li key={s._id} className="flex items-center justify-between text-sm">
                  <span>{s.title}</span>
                  <StatusPill variant="info">{(s as any).status}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </HoloCard>
      </section>
      <section className="mb-6">
        <NighthawkQueue />
      </section>
      <section>
        <HoloCard>
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">System health</h2>
            <StatusPill variant={health?.overall === "operational" ? "success" : health?.overall === "degraded" ? "warning" : "danger"}>
              Fleet: {health?.overall ?? "syncing"}
            </StatusPill>
          </header>
          {health ? (
            <ul className="grid sm:grid-cols-2 gap-2 list-none p-0 m-0">
              {health.subsystems.map((s) => (
                <li key={s.key} className="text-sm flex items-center gap-2">
                  <StatusPill
                    variant={
                      s.status === "ok"
                        ? "success"
                        : s.status === "warning"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {s.status}
                  </StatusPill>
                  <span>{s.label}</span>
                  <span className="text-uf-muted text-xs">{s.note}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="uf-skeleton" style={{ height: 120 }} />
          )}
          <NeonButton className="mt-4" onClick={() => location.reload()} variant="ghost">
            Refresh
          </NeonButton>
        </HoloCard>
      </section>

      <EasterEggBadge />
    </OperatorShell>
  );
}
