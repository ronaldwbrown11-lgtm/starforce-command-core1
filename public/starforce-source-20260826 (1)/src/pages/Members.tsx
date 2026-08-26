import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
} from "@/components/uf";
import { RankProgress } from "@/components/widgets/RankProgress";
import { FleetAffiliation } from "@/components/widgets/FleetAffiliation";
import { useAuth } from "@/hooks/use-auth";
import {
  TIER_ORDER,
  tierLabel,
  tierPillVariant,
} from "@/lib/tiers";
import type { Doc } from "@/convex/_generated/dataModel";

import { usePageMeta } from "@/hooks/use-page-meta";
/** How recent a lastSeen timestamp must be to count as “online”. */
const ONLINE_CUTOFF_MS = 15 * 60 * 1000;

export default function Members() {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  // Stable per-mount timestamp (impure calls are banned during render).
  const [now] = useState(() => Date.now());
  const cutoff = now - ONLINE_CUTOFF_MS;
  const { user: me } = useAuth();
  const members = useQuery(api.social.listMembers, {
    search,
    limit: 80,
    tier: tier || undefined,
    onlineOnly: onlineOnly || undefined,
  });
  usePageMeta({ title: "Fleet Roster — Star Force Base 1198", description: "Browse the members of Star Force — pilots, specialists, and command staff.", noindex: false });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Members"
        title="Roster of the fleet."
        lead="Search by name, fleet, or rank. Online / offline status. Tier badges. Quick actions."
        primary={{ label: "Open Activity Feed", href: "/activity", variant: "primary" }}
        secondary={{ label: "Your commands", href: "/account", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid md:grid-cols-[1fr_1fr_1fr_300px] gap-3 mb-6">
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="name / email / fleet…"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Tier
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            >
              <option value="">Any tier</option>
              {TIER_ORDER.map((id) => (
                <option key={id} value={id}>
                  {tierLabel(id)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Status
            <button
              type="button"
              onClick={() => setOnlineOnly((v) => !v)}
              aria-pressed={onlineOnly}
              className={
                "border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm text-left " +
                (onlineOnly
                  ? "bg-[rgba(45,255,136,0.10)] text-[color:var(--uf-green)]"
                  : "bg-[rgba(16,24,39,0.5)]")
              }
            >
              {onlineOnly ? "Online only (active)" : "Any status"}
            </button>
          </label>
          <div className="md:col-span-1">
            <RankProgress />
          </div>
        </div>
        {members === undefined ? (
          <div className="uf-grid uf-grid--4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 200 }} />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="uf-empty">No roster matches.</div>
        ) : (
          <div className="uf-grid uf-grid--4">
            {members.map((m) => (
              <MemberCard
                key={m._id}
                member={m}
                cutoff={cutoff}
                isMe={!!me && me._id === m._id}
              />
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}

function MemberCard({
  member,
  cutoff,
  isMe,
}: {
  member: Doc<"users">;
  cutoff: number;
  isMe: boolean;
}) {
  const avatarUrl = useQuery(
    api.assets.coverUrl,
    member.avatarStorageId
      ? { storageId: member.avatarStorageId }
      : "skip",
  );
  const online = (member.lastSeen ?? 0) > cutoff;
  const xp = member.xp ?? 0;
  const pct = Math.min(100, (xp / 20000) * 100);
  const name =
    member.displayName ?? member.email?.split("@")[0] ?? "Unnamed";
  const initials = name.charAt(0).toUpperCase();

  return (
    <HoloCard>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            aria-hidden
            className="h-11 w-11 rounded-full shrink-0 grid place-items-center overflow-hidden"
            style={{
              background:
                "conic-gradient(from 220deg, var(--uf-cyan), var(--uf-violet), var(--uf-magenta), var(--uf-cyan))",
              boxShadow: "0 0 12px rgba(0,229,255,0.3)",
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <span
                style={{
                  background: "var(--uf-void)",
                  color: "var(--uf-text)",
                  width: 39,
                  height: 39,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                }}
              >
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold break-words leading-snug">
              {name}
            </h3>
            {isMe ? (
              <StatusPill variant="gold">You</StatusPill>
            ) : (
              <StatusPill variant={online ? "success" : "default"}>
                {online ? "Online" : "Offline"}
              </StatusPill>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {member.rank ? <StatusPill variant="info">{member.rank}</StatusPill> : null}
        {member.tier ? (
          <StatusPill variant={tierPillVariant(member.tier)}>
            {tierLabel(member.tier)}
          </StatusPill>
        ) : null}
        {member.fleet ? <FleetAffiliation fleet={member.fleet} compact /> : null}
      </div>
      <div
        className="uf-progress mt-3"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`XP progress for ${name}`}
      >
        <div className="uf-progress__bar" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-uf-muted mt-2">{xp.toLocaleString()} XP</p>
      <div className="flex gap-2 mt-4">
        <Link to={`/u/${member._id}`} className="flex-1">
          <NeonButton variant="ghost" className="w-full">
            View dossier
          </NeonButton>
        </Link>
        <Link to={`/messages?recipient=${member._id}`} className="flex-1">
          <NeonButton variant="primary" className="w-full">
            Send comms
          </NeonButton>
        </Link>
      </div>
    </HoloCard>
  );
}
