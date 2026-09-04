import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Link, useParams } from "react-router";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
} from "@/components/uf";
import { ProfileEditor } from "@/components/ProfileEditor";
import { AchievementBadges } from "@/components/widgets/AchievementBadges";
import { ServiceDossierPanel } from "@/components/widgets/ServiceDossierPanel";
import { FleetAffiliation } from "@/components/widgets/FleetAffiliation";
import { Flair } from "@/components/widgets/Flair";
import { useAuth } from "@/hooks/use-auth";
import { tierLabel, tierPillVariant } from "@/lib/tiers";
import { FRAME_CATALOG } from "@/lib/economy";

import { usePageMeta } from "@/hooks/use-page-meta";
export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const profile = useQuery(
    api.social.userProfile,
    id ? { id: id as Id<"users"> } : "skip",
  );
  const avatarUrl = useQuery(
    api.assets.coverUrl,
    profile?.avatarStorageId
      ? { storageId: profile.avatarStorageId as Id<"_storage"> }
      : "skip",
  );
  const contributions = useQuery(
    api.social.userContributions,
    id ? { id: id as Id<"users"> } : "skip",
  );
  usePageMeta({
    title: "Pilot Profile — Star Force Base 1198",
    description: "View a pilots career, stories, reports, and fleet record.",
    noindex: false,
  });

  if (profile === undefined) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Dossier"
          title="Loading operator record…"
          lead="Pulling the active member file."
        />
      </SiteShell>
    );
  }
  if (!profile) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Dossier"
          title="Operator not found"
          lead="This record is missing or has been scrubbed."
          primary={{
            label: "Back to roster",
            href: "/members",
            variant: "primary",
          }}
        />
      </SiteShell>
    );
  }
  if (profile.isAnonymous) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Dossier"
          title="No public dossier"
          lead="This account hasn't published a public profile yet."
          primary={{
            label: "Back to roster",
            href: "/members",
            variant: "ghost",
          }}
        />
      </SiteShell>
    );
  }

  const isMe = !!me && me._id === profile._id;
  const profileName =
    profile.displayName ?? profile.email?.split("@")[0] ?? "Unnamed";
  const initials = profileName.charAt(0).toUpperCase();
  const createdAt = profile._creationTime;
  const achievementIds = (profile.achievements ?? []) as string[];

  const startEditProfile = () => setEditingProfile(true);

  return (
    <SiteShell>
      <PageHero
        eyebrow="Operator dossier"
        title={profileName}
        lead={
          profile.bio ??
          "Active member of Star Force Base 1198. Rank, XP, and contributions below."
        }
        primary={
          isMe
            ? { label: "Open account", href: "/account", variant: "primary" }
            : {
                label: "Send comms",
                href: `/messages?recipient=${profile._id}`,
                variant: "primary",
              }
        }
        secondary={{ label: "Back to roster", href: "/members", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="uf-grid uf-grid--3">
          <HoloCard>
            <div className="flex items-center gap-3 mb-3">
              <div
                aria-hidden
                className="h-14 w-14 rounded-full flex items-center justify-center text-2xl font-semibold shrink-0 overflow-hidden"
                style={
                  profile?.frame && FRAME_CATALOG[profile.frame]
                    ? {
                        background: `conic-gradient(from 220deg, ${FRAME_CATALOG[profile.frame].colors[0]}, ${FRAME_CATALOG[profile.frame].colors[1]}, ${FRAME_CATALOG[profile.frame].colors[2]}, ${FRAME_CATALOG[profile.frame].colors[0]})`,
                        color: "#001018",
                        boxShadow: `0 0 18px ${FRAME_CATALOG[profile.frame].colors[0]}66`,
                      }
                    : {
                        background:
                          "conic-gradient(from 220deg, var(--uf-cyan), var(--uf-violet), var(--uf-magenta), var(--uf-cyan))",
                        color: "#001018",
                        boxShadow: "0 0 18px rgba(0,229,255,0.35)",
                      }
                }
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-14 w-14 object-cover"
                  />
                ) : (
                <span
                  style={{
                    background: "var(--uf-void)",
                    color: "var(--uf-text)",
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {initials}
                </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-semibold truncate">
                    {profileName}
                  </h2>
                  {profile.flair ? <Flair label={profile.flair} /> : null}
                </div>
                {profile.fleet ? (
                  <p className="text-uf-muted text-xs">{profile.fleet}</p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.rank ? (
                <StatusPill variant="info">{profile.rank}</StatusPill>
              ) : null}
              {profile.tier ? (
                <StatusPill variant={tierPillVariant(profile.tier)}>
                  {tierLabel(profile.tier)}
                </StatusPill>
              ) : null}
              {profile.fleet ? (
                <FleetAffiliation fleet={profile.fleet} />
              ) : null}
            </div>
            {profile.bio ? (
              <p className="text-uf-muted text-sm mt-4 line-clamp-4">
                {profile.bio}
              </p>
            ) : null}
            {isMe && editingProfile ? (
              <div className="mt-6">
                <ProfileEditor
                  initial={{
                    displayName: profile.displayName,
                    rank: profile.rank,
                    fleet: profile.fleet,
                    bio: profile.bio,
                    flair: profile.flair,
                    avatarStorageId: profile.avatarStorageId,
                  }}
                  paidMember={(me?.tier ?? "free") !== "free"}
                  tier={me?.tier ?? "free"}
                  submitLabel="Save dossier"
                  onSaved={() => setEditingProfile(false)}
                  onCancel={() => setEditingProfile(false)}
                />
              </div>
            ) : isMe ? (
              <div className="flex flex-wrap gap-2 mt-6">
                <NeonButton variant="ghost" onClick={startEditProfile}>
                  Edit profile
                </NeonButton>
                <Link to="/lore/submit" className="block">
                  <NeonButton variant="primary">Submit lore</NeonButton>
                </Link>
              </div>
            ) : (
              <Link
                to={`/messages?recipient=${profile._id}`}
                className="block mt-6"
              >
                <NeonButton variant="primary">Send comms</NeonButton>
              </Link>
            )}
          </HoloCard>
          <RankCardFor userId={profile._id} />
          <HoloCard>
            <span className="uf-eyebrow">Member details</span>
            <ul className="text-sm mt-3 space-y-2 list-none p-0 m-0">
              <li>
                <strong>{(profile.xp ?? 0).toLocaleString()}</strong> XP
              </li>
              <li>
                <strong>{profile.contributionCount ?? 0}</strong> verified
                contribution{(profile.contributionCount ?? 0) === 1 ? "" : "s"}
              </li>
              <li>
                <strong>{(profile.credits ?? 0).toLocaleString()}</strong> Star
                Credits
              </li>
              <li>
                <strong>{achievementIds.length}</strong> achievement
                {achievementIds.length === 1 ? "" : "s"} unlocked
              </li>
              {createdAt ? (
                <li>
                  Joined:{" "}
                  <time dateTime={new Date(createdAt).toISOString()}>
                    {formatDate(createdAt)}
                  </time>
                </li>
              ) : null}
              <li>
                Last seen:{" "}
                <time
                  dateTime={
                    profile.lastSeen
                      ? new Date(profile.lastSeen).toISOString()
                      : undefined
                  }
                >
                  {profile.lastSeen
                    ? new Date(profile.lastSeen).toLocaleString()
                    : "unknown"}
                </time>
              </li>
            </ul>
          </HoloCard>
        </div>
        {achievementIds.length > 0 ? (
          <div className="mt-6">
            <HoloCard>
              <span className="uf-eyebrow">Achievements</span>
              <div className="mt-3">
                <AchievementBadges
                  ids={achievementIds}
                  displayName={profileName}
                />
              </div>
            </HoloCard>
          </div>
        ) : null}
        <div className="mt-6">
          <ServiceDossierPanel userId={profile._id} />
        </div>
        {contributions !== undefined ? (
          <div className="mt-6">
            <ServiceRecord contributions={contributions} />
          </div>
        ) : null}
      </section>
    </SiteShell>
  );
}

// =========================================================================
// Service Record — everything the member has authored, grouped by type.
// =========================================================================

type ContributionGroup<T> = Array<T & { createdAt?: number }>;

type Contributions = {
  stories: ContributionGroup<{
    _id: string;
    title: string;
    slug: string;
    status: string;
    series: string | null;
    views: number;
    publishedAt: number | null;
    updatedAt: number;
  }>;
  lore: ContributionGroup<{
    _id: string;
    title: string;
    slug: string;
    entryType: string | null;
    createdAt: number;
  }>;
  loreItems: ContributionGroup<{
    _id: string;
    title: string;
    slug: string;
    loreType: string | null;
    status: string;
    createdAt: number;
  }>;
  reports: ContributionGroup<{
    _id: string;
    title: string;
    createdAt: number;
  }>;
  threads: ContributionGroup<{
    _id: string;
    title: string;
    slug: string;
    replyCount: number;
    createdAt: number;
  }>;
  comments: ContributionGroup<{
    _id: string;
    content: string;
    parentType: string;
    createdAt: number;
  }>;
  replies: ContributionGroup<{
    _id: string;
    content: string;
    createdAt: number;
  }>;
  memberships: Array<{
    groupId: string;
    groupName: string;
    groupSlug: string;
    role: string;
    joinedAt: number;
  }>;
  activity: ContributionGroup<{
    _id: string;
    verb: string;
    targetType: string;
    summary: string | null;
    createdAt: number;
  }>;
};

function ServiceRecord({ contributions }: { contributions: Contributions }) {
  const { stories, lore, loreItems, reports, threads, comments, replies, memberships, activity } =
    contributions;
  const total =
    stories.length + lore.length + loreItems.length + reports.length + threads.length + comments.length + replies.length;
  if (!total && memberships.length === 0 && activity.length === 0) return null;

  return (
    <HoloCard>
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <span className="uf-eyebrow">Contributions</span>
          <h2 className="text-2xl font-semibold mt-2">
            Field contributions.
          </h2>
        </div>
        <span className="font-mono text-2xl text-uf-cyan tabular-nums">
          {String(total).padStart(2, "0")}
          <span className="text-xs text-uf-muted ml-1">FILED</span>
        </span>
      </header>

      <div className="grid gap-6 mt-5 lg:grid-cols-2">
        {stories.length > 0 ? (
          <ServiceGroup
            label="Stories"
            count={stories.length}
            tone="var(--uf-cyan)"
          >
            {stories.map((s) => (
              <Link key={s._id} to={`/stories/${s.slug}`} className="block">
                <ServiceRow
                  title={s.title}
                  meta={
                    s.series
                      ? `${s.series} · ${s.views.toLocaleString()} views`
                      : `${s.views.toLocaleString()} views`
                  }
                  badge={
                    s.status === "published" ? "Published" : s.status
                  }
                  badgeTone={
                    s.status === "published"
                      ? "var(--uf-green)"
                      : s.status === "submitted" || s.status === "in_review"
                        ? "var(--uf-gold)"
                        : "var(--uf-muted)"
                  }
                  date={s.publishedAt ?? s.updatedAt}
                />
              </Link>
            ))}
          </ServiceGroup>
        ) : null}

        {lore.length > 0 ? (
          <ServiceGroup
            label="Lore entries"
            count={lore.length}
            tone="var(--uf-violet)"
          >
            {lore.map((l) => (
              <Link key={l._id} to={`/lore/${l.slug}`} className="block">
                <ServiceRow
                  title={l.title}
                  meta={
                    l.entryType ? l.entryType : "archive entry"
                  }
                  badge="Canon"
                  badgeTone="var(--uf-violet)"
                  date={l.createdAt}
                />
              </Link>
            ))}
          </ServiceGroup>
        ) : null}

        {loreItems.length > 0 ? (
          <ServiceGroup
            label="Lore library"
            count={loreItems.length}
            tone="var(--uf-violet)"
          >
            {loreItems.map((l) => (
              <Link key={l._id} to={`/lore/${l.slug}`} className="block">
                <ServiceRow
                  title={l.title}
                  meta={`${l.loreType ?? "item"} · ${new Date(l.createdAt).toLocaleDateString()}`}
                  badge={l.status === "approved" ? "In library" : l.status}
                  badgeTone={
                    l.status === "approved"
                      ? "var(--uf-green)"
                      : l.status === "submitted"
                        ? "var(--uf-gold)"
                        : "var(--uf-muted)"
                  }
                  date={l.createdAt}
                />
              </Link>
            ))}
          </ServiceGroup>
        ) : null}

        {threads.length > 0 ? (
          <ServiceGroup
            label="Forum threads"
            count={threads.length}
            tone="var(--uf-gold)"
          >
            {threads.map((t) => (
              <Link
                key={t._id}
                to={`/forums?thread=${t.slug}`}
                className="block"
              >
                <ServiceRow
                  title={t.title}
                  meta={`${t.replyCount} repl${t.replyCount === 1 ? "y" : "ies"}`}
                  badge="Thread"
                  badgeTone="var(--uf-gold)"
                  date={t.createdAt}
                />
              </Link>
            ))}
          </ServiceGroup>
        ) : null}

        {reports.length > 0 ? (
          <ServiceGroup
            label="Fleet reports"
            count={reports.length}
            tone="var(--uf-green)"
          >
            {reports.map((r) => (
              <ServiceRow
                key={r._id}
                title={r.title}
                meta="mission report"
                badge="Filed"
                badgeTone="var(--uf-green)"
                date={r.createdAt}
              />
            ))}
          </ServiceGroup>
        ) : null}

        {comments.length > 0 ? (
          <ServiceGroup
            label="Comments"
            count={comments.length}
            tone="var(--uf-cyan)"
          >
            {comments.map((c) => (
              <ServiceRow
                key={c._id}
                title={c.content.length > 80 ? `${c.content.slice(0, 80)}…` : c.content}
                meta={`on ${c.parentType}`}
                badge="Comment"
                badgeTone="var(--uf-cyan)"
                date={c.createdAt}
              />
            ))}
          </ServiceGroup>
        ) : null}

        {replies.length > 0 ? (
          <ServiceGroup
            label="Forum replies"
            count={replies.length}
            tone="var(--uf-gold)"
          >
            {replies.map((r) => (
              <ServiceRow
                key={r._id}
                title={r.content.length > 80 ? `${r.content.slice(0, 80)}…` : r.content}
                meta="reply in a thread"
                badge="Reply"
                badgeTone="var(--uf-gold)"
                date={r.createdAt}
              />
            ))}
          </ServiceGroup>
        ) : null}
      </div>

      {memberships.length > 0 ? (
        <section className="mt-6">
          <h3 className="uf-eyebrow mb-3">Group affiliations</h3>
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {memberships.map((m) => (
              <li key={m.groupId}>
                <Link
                  to={m.groupSlug ? `/groups/${m.groupSlug}` : "/groups"}
                  className="rounded-md border border-[color:var(--uf-border)] p-3 flex items-center gap-3 transition-colors hover:border-[color:var(--uf-cyan)]"
                >
                  <span className="min-w-0 flex-1 text-sm font-semibold truncate">
                    {m.groupName}
                  </span>
                  <span
                    className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em]"
                    style={{
                      color:
                        m.role === "owner"
                          ? "var(--uf-gold)"
                          : m.role === "moderator"
                            ? "var(--uf-cyan)"
                            : "var(--uf-muted)",
                      borderColor:
                        m.role === "owner"
                          ? "var(--uf-gold)"
                          : m.role === "moderator"
                            ? "var(--uf-cyan)"
                            : "var(--uf-border)",
                    }}
                  >
                    {m.role}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activity.length > 0 ? (
        <section className="mt-6" aria-label="Recent activity">
          <h3 className="uf-eyebrow mb-3">Recent activity</h3>
          <ol className="flex flex-col list-none p-0 m-0 relative before:content-[''] before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-[color:var(--uf-border)]">
            {activity.map((a) => (
              <li
                key={a._id}
                className="relative pl-6 pb-3 text-sm last:pb-0 before:content-[''] before:absolute before:left-0 before:top-[5px] before:h-2.5 before:w-2.5 before:rounded-full before:bg-[var(--uf-cyan)] before:shadow-[0_0_8px_rgba(0,229,255,0.6)]"
              >
                <span className="capitalize text-[var(--uf-cyan)]">
                  {a.verb.replace(/_/g, " ")}
                </span>{" "}
                <span className="text-uf-muted">→ {a.targetType}</span>
                {a.summary ? (
                  <span className="text-uf-muted"> · {a.summary}</span>
                ) : null}
                <span className="block text-xs text-uf-muted/70">
                  {formatDate(a.createdAt ?? 0)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </HoloCard>
  );
}

function ServiceGroup({
  label,
  count,
  tone,
  children,
}: {
  label: string;
  count: number;
  tone: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-md border border-[color:var(--uf-border)] p-4 bg-[rgba(16,24,39,0.5)]"
      aria-label={`${label}: ${count}`}
    >
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-[0.18em] font-semibold" style={{ color: tone }}>
          {label}
        </h3>
        <span className="font-mono text-xs text-uf-muted tabular-nums">
          {String(count).padStart(2, "0")}
        </span>
      </header>
      <ul className="flex flex-col gap-2 list-none p-0 m-0">{children}</ul>
    </section>
  );
}

function ServiceRow({
  title,
  meta,
  badge,
  badgeTone,
  date,
}: {
  title: string;
  meta: string;
  badge: string;
  badgeTone: string;
  date?: number;
}) {
  return (
    <article className="rounded-md border border-[color:var(--uf-border)] p-3 flex items-center gap-3 transition-colors hover:border-[color:var(--uf-cyan)]">
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold truncate">{title}</h4>
        <p className="text-uf-muted text-xs mt-0.5 truncate">
          {meta}
          {date ? ` · ${formatDate(date)}` : ""}
        </p>
      </div>
      <span
        className="shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em]"
        style={{ color: badgeTone, borderColor: badgeTone, opacity: 0.9 }}
      >
        {badge}
      </span>
    </article>
  );
}

function RankCardFor({ userId }: { userId: Id<"users"> }) {
  const r = useQuery(api.social.rankProgress, { userId });
  if (r === undefined) {
    return (
      <HoloCard>
        <div className="uf-skeleton" style={{ height: 96 }} />
      </HoloCard>
    );
  }
  if (!r) return null;
  return (
    <HoloCard>
      <header className="flex items-center justify-between mb-3">
        <span className="uf-eyebrow">Rank progress</span>
        <StatusPill variant="info">{r.rank}</StatusPill>
      </header>
      <div
        className="uf-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={r.percent}
        aria-label={`Progress to ${r.nextRank ?? "max"}`}
      >
        <div className="uf-progress__bar" style={{ width: `${r.percent}%` }} />
      </div>
      <p className="text-sm text-uf-muted mt-3">
        {r.xp.toLocaleString()} XP
        {r.nextRank
          ? ` — ${r.percent}% to ${r.nextRank} (${(r.nextThreshold ?? 0).toLocaleString()} XP)`
          : ""}
      </p>
    </HoloCard>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
