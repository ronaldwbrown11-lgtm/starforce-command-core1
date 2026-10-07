import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Compass,
  Crown,
  Feather,
  Globe,
  Images,
  Play,
  Radio,
  Sparkles,
  Users,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  SiteShell,
  NeonButton,
  HoloCard,
  StatusPill,
  SectionHeader,
} from "@/components/uf";
import { ScrollReveal, ScaleReveal } from "@/hooks/use-scroll-reveal";
import { LiveCommandStrip } from "@/components/widgets/LiveCommandStrip";
import { VOICE } from "@/lib/voice";
import { REVIEWS, reviewAggregate } from "@/lib/reviews";
import goldPlateUrl from "@/assets/gold-plate-texture.jpg";

import { usePageMeta } from "@/hooks/use-page-meta";
// ---- Theming: small palette of gradient cover plates ---------------------
const COVERS = [
  "linear-gradient(135deg, rgba(0,229,255,0.35) 0%, rgba(139,92,246,0.35) 60%, rgba(255,61,242,0.30) 100%)",
  "linear-gradient(135deg, rgba(230,168,23,0.25) 0%, rgba(255,61,242,0.30) 50%, rgba(0,229,255,0.30) 100%)",
  "linear-gradient(135deg, rgba(139,92,246,0.30) 0%, rgba(0,229,255,0.25) 50%, rgba(45,255,136,0.20) 100%)",
  "linear-gradient(135deg, rgba(45,255,136,0.25) 0%, rgba(0,229,255,0.30) 60%, rgba(139,92,246,0.30) 100%)",
];

function coverAt(i: number) {
  return COVERS[i % COVERS.length];
}

// =========================================================================
// Latest Wings Earner — the gold "lace" ribbon, a slim strip in the page
// flow below the Live Command Strip. Announces the newest pilot to earn
// their wings (latest non-revoked starfighter claim, via
// api.starfighters.latestWingsEarner). Sized like the “Submit Your Story”
// box. The operator can turn it on/off via wingsSettings.homepageRibbonEnabled.
// Hidden while off, while loading, or while nobody has earned wings.
// =========================================================================

type WingsEarner = {
  _id: string;
  memberName: string;
  memberRank: string | null;
  memberId: string;
  callsign: string;
  designation: string;
  hullNumber: string;
  awardedAt: number;
};

function WingsEarnerBox({
  earner,
  enabled,
}: {
  earner: WingsEarner | null | undefined;
  enabled: boolean | undefined;
}) {
  const reducedMotion = useReducedMotion();

  // Loading — hold a box-sized slot (half the container width) so the
  // layout doesn't jump.
  if (earner === undefined || enabled === undefined) {
    return (
      <div className="relative px-4 pb-8 sm:px-6 lg:px-12" aria-hidden>
        <div className="uf-container">
          <div className="uf-skeleton mx-auto h-[228px] w-full max-w-3xl rounded-md" />
        </div>
      </div>
    );
  }

  // Operator switched it off, or nobody has earned wings yet.
  if (!enabled || earner === null) return null;

  // Demo/sample plaques (from the operator's preview seed) have no real
  // member profile behind them — their memberId points at the issuing
  // operator. Salute links only to real pilots.
  const isDemo = earner._id.endsWith("-demo") || earner.memberName === "Pilot";

  return (
    <motion.section
      aria-labelledby="uf-wings-ribbon-title"
      className="relative px-4 pb-8 sm:px-6 lg:px-12"
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="uf-container">
        <div
          className="mx-auto w-full max-w-3xl p-6 md:p-10 text-center rounded-md border border-[color:var(--uf-border)]"
          style={{
            // The gold plate IS the background — same asset as the Wall of
            // Honor plaques, with a soft sheen gradient for metal depth.
            backgroundImage: `linear-gradient(180deg, rgba(255,244,200,0.50) 0%, rgba(255,255,255,0) 35%, rgba(90,60,10,0.26) 100%), url(${goldPlateUrl})`,
            backgroundSize: "100% 100%, cover",
            backgroundPosition: "center",
          }}
        >
          {/* Wings medallion — engraved bronze on the plate */}
          <span
            aria-hidden
            className="mx-auto grid h-12 w-12 place-items-center rounded-full"
            style={{
              border: "1.5px solid #4a3608",
              background: "rgba(90,60,10,0.14)",
              color: "#3a2a08",
            }}
          >
            <Feather className="h-5 w-5" />
          </span>

          <span
            id="uf-wings-ribbon-title"
            className="mt-3 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "#4a3608" }}
          >
            <span aria-hidden>◆</span>
            Latest Wings Earner
            <span aria-hidden>◆</span>
          </span>

          <h3
            className="mt-2 text-2xl font-semibold"
            style={{ color: "#2a1c05" }}
          >
            {earner.memberRank ? `${earner.memberRank} ` : ""}
            {earner.memberName}
          </h3>
          <p
            className="uf-hud mx-auto mt-2 max-w-xl text-xs"
            style={{ color: "#5b430f" }}
          >
            “{earner.callsign}” · {earner.hullNumber} · {earner.designation}
            {" · "}
            <span style={{ color: "#3a2a08" }}>
              wings earned {timeAgo(earner.awardedAt)}
            </span>
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {isDemo ? (
              <span
                className="uf-btn uf-btn--sm opacity-60"
                style={{
                  background: "#2a1c05",
                  color: "#ffedc2",
                  borderColor: "transparent",
                  cursor: "not-allowed",
                }}
                title="Sample plaque — no profile to salute"
              >
                Sample plaque
              </span>
            ) : (
              <Link
                to={`/u/${earner.memberId}`}
                className="uf-btn uf-btn--sm"
                style={{
                  background: "#2a1c05",
                  color: "#ffedc2",
                  borderColor: "transparent",
                }}
              >
                Salute the pilot
              </Link>
            )}
            <Link
              to="/honor"
              className="uf-btn uf-btn--sm"
              style={{
                background: "transparent",
                color: "#3a2a08",
                borderColor: "#4a3608",
              }}
            >
              <span>Wall of Honor</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export default function Home() {
  const stats = useQuery(api.content.getHomeStats);
  const featuredStories = useQuery(api.content.listFeaturedStories, { limit: 2 });
  const featuredLore = useQuery(api.content.listFeaturedLore, { limit: 3 });
  const featuredArt = useQuery(api.visuals.listAssets, { limit: 4 });
  const videoLineup = useQuery(api.content.getFeaturedVideoLineup);
  const topCadets = useQuery(api.content.popularMembersList, { limit: 3 });
  const forumThreads = useQuery(api.groups.trendingForumThreads, { limit: 3 });
  const groups = useQuery(api.groups.listGroups, {});
  const fleetReports = useQuery(api.content.listFleetReports, { limit: 1 });
  const latestWings = useQuery(api.starfighters.latestWingsEarner, {});
  const wingsSettings = useQuery(api.wings.getWingsSettings, {});

  const primaryStory = featuredStories?.[0] ?? null;
  const secondaryStory = featuredStories?.[1] ?? null;
  const fleetUpdate = fleetReports?.[0] ?? null;
  usePageMeta({ title: "Star Force Base 1198 — A Living Sci-Fi Universe", description: "Submit stories and lore, explore the archive, join fleet groups, and climb the ranks.", noindex: false });


  return (
    <SiteShell>
      {/* =========== HERO + LIVE FROM THE FLEET (right panel) ============ */}
      <section
        aria-labelledby="uf-hero-title"
        className="relative pt-14 pb-12 px-4 sm:px-6 lg:px-12"
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 600px at 18% 30%, rgba(0,229,255,0.16), transparent 60%), radial-gradient(700px 480px at 80% 20%, rgba(139,92,246,0.16), transparent 60%)",
          }}
        />
        <div className="relative uf-container grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          {/* Hero copy */}
          <ScrollReveal className="max-w-2xl">
            <span className="uf-eyebrow">SCI-FI COMMUNITY</span>
            <h1
              id="uf-hero-title"
              className="mt-3 text-4xl md:text-5xl lg:text-6xl font-semibold leading-[1.05] uf-glow-text"
            >
              {VOICE.heroTitle}
            </h1>
            <p className="text-uf-muted mt-4 text-base md:text-lg max-w-xl">
              {VOICE.heroLead}
            </p>
            <div className="flex flex-wrap gap-3 mt-7">
              <Link to="/auth">
                <NeonButton variant="primary">Join the Fleet</NeonButton>
              </Link>
              <Link to="/videos">
                <NeonButton variant="ghost">Browse Now</NeonButton>
              </Link>
            </div>
          </ScrollReveal>

          {/* Live from the Fleet — right rail */}
          <LiveFromTheFleetPanel
            primaryStory={primaryStory}
            fleetUpdate={fleetUpdate}
            onlineNow={stats?.onlineNow ?? 480}
            totalCadets={stats?.totalCadets ?? 12450}
          />
        </div>
      </section>

      {/* =========== LIVE COMMAND STRIP (telemetry + sector chatter) ====== */}
      <LiveCommandStrip />

      {/* =========== LATEST WINGS EARNER (gold-plate box) ================ */}
      <WingsEarnerBox earner={latestWings} enabled={wingsSettings?.homepageRibbonEnabled} />

      {/* =========== FEATURED STORIES (3-col) ============ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Featured Stories"
            title="Featured stories from the canon."
            icon={<Sparkles className="h-4 w-4" />}
          />
        </ScrollReveal>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {/* Primary story */}
          {primaryStory === undefined ? (
            <FeaturedStoryCardSkeleton height={260} />
          ) : primaryStory ? (
            <FeaturedStoryCard
              story={primaryStory}
              coverIndex={0}
              eyebrow={primaryStory.series ?? "Top pick"}
              meta={buildStoryMeta(primaryStory)}
              large
            />
          ) : (
            <FeaturedStoryPlaceholder
              title="No featured story yet"
              hint="Operators can pin a story from the Story Approval queue."
              coverIndex={0}
              large
            />
          )}

          {/* Secondary story */}
          {secondaryStory === undefined ? (
            <FeaturedStoryCardSkeleton height={260} />
          ) : secondaryStory ? (
            <FeaturedStoryCard
              story={secondaryStory}
              coverIndex={1}
              eyebrow={secondaryStory.series ?? "Featured"}
              meta={buildStoryMeta(secondaryStory)}
              large
            />
          ) : (
            <FeaturedStoryPlaceholder
              title="Pin a second story"
              hint="Operators can feature up to two story cards here."
              coverIndex={1}
              large
            />
          )}

          {/* Submit Your Story CTA */}
          <div
            className="rounded-md border border-[color:var(--uf-border)] p-6 flex flex-col justify-center items-center text-center relative overflow-hidden"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,229,255,0.16), rgba(139,92,246,0.12))",
            }}
          >
            <span
              aria-hidden
              className="absolute -top-10 -right-10 inline-block h-40 w-40 rounded-full"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(0,229,255,0.30), transparent 70%)",
              }}
            />
            <h3 className="text-2xl font-semibold relative">
              Submit Your Story
            </h3>
            <p className="text-uf-muted text-sm mt-2 max-w-sm relative">
              Add to the official canon. Get featured.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3 relative">
              <Link to="/submit">
                <NeonButton variant="primary">Submit Story</NeonButton>
              </Link>
              <Link to="/stories">
                <NeonButton variant="ghost">Browse Archive</NeonButton>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========== FEATURED VIDEO + UP NEXT ============ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Featured Video"
            title="Live broadcast — sector Sol system-Gemini."
            icon={<Play className="h-4 w-4" />}
            action={
              <Link to="/videos" className="uf-btn uf-btn--ghost">
                <span>Open Channel</span>
                <ChevronRight className="h-4 w-4 ml-1 inline-block" />
              </Link>
            }
          />
        </ScrollReveal>
        <div className="mt-6 grid gap-5 lg:grid-cols-[2fr_1fr] items-start">
          {/* Now Playing */}
          <div className="relative">
            {videoLineup?.nowPlaying === undefined ? (
              <div className="uf-skeleton" style={{ height: 320 }} />
            ) : videoLineup.nowPlaying === null ? (
              <HoloCard>
                <div className="uf-empty">No live broadcast pinned.</div>
              </HoloCard>
            ) : (
              <article
                className="rounded-md border border-[color:var(--uf-border)] overflow-hidden relative"
                aria-label={`Now playing: ${videoLineup.nowPlaying.title}`}
              >
                <div
                  className="aspect-video relative"
                  aria-hidden
                >
                  {videoLineup.nowPlaying.coverUrl ? (
                    <img
                      src={videoLineup.nowPlaying.coverUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,61,242,0.22), rgba(0,229,255,0.22))",
                      }}
                    />
                  )}
                  <Link
                    to="/videos"
                    className="absolute inset-0 grid place-items-center focus:outline-none"
                    aria-label="Play broadcast on the channel"
                  >
                    <span
                      className="inline-flex items-center justify-center h-16 w-16 rounded-full transition-transform hover:scale-110"
                      style={{
                        background: "rgba(0, 16, 24, 0.65)",
                        boxShadow:
                          "0 0 0 1px rgba(0,229,255,0.45), 0 0 24px rgba(0,229,255,0.35)",
                      }}
                    >
                      <Play className="h-7 w-7 text-uf-cyan" />
                    </span>
                  </Link>
                  <span
                    className="absolute top-4 left-4 text-[10px] uppercase tracking-[0.18em] text-white"
                    style={{
                      background: "rgba(0,0,0,0.55)",
                      padding: "6px 12px",
                      borderRadius: 999,
                    }}
                  >
                    Now Playing
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-semibold">
                    {videoLineup.nowPlaying.title}
                  </h3>
                  <p className="text-uf-muted text-sm mt-2">
                    {videoLineup.nowPlaying.description}
                  </p>
                  <p className="text-uf-muted text-xs mt-3 flex flex-wrap gap-3">
                    <span>
                      Duration:{" "}
                      <strong>
                        {videoLineup.nowPlaying.durationSeconds
                          ? `${Math.round(
                              videoLineup.nowPlaying.durationSeconds / 60,
                            )} min`
                          : "—"}
                      </strong>
                    </span>
                    <span>
                      Type:{" "}
                      <strong>
                        {videoLineup.nowPlaying.transmissionType ?? "briefing"}
                      </strong>
                    </span>
                  </p>
                </div>
              </article>
            )}
          </div>

          {/* Up Next */}
          <aside aria-label="Up Next">
            <header className="mb-3 flex items-center justify-between">
              <span className="uf-eyebrow">Upcoming Transmissions</span>
              <span className="text-uf-muted text-xs uppercase tracking-[0.16em]">
                Up Next
              </span>
            </header>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              {videoLineup === undefined ? (
                [0, 1, 2].map((i) => (
                  <li key={i}>
                    <div className="uf-skeleton" style={{ height: 76 }} />
                  </li>
                ))
              ) : videoLineup.upNext.length === 0 ? (
                <li>
                  <div className="uf-empty">No upcoming transmissions.</div>
                </li>
              ) : (
                videoLineup.upNext.map((t, idx) => (
                  <li key={t._id}>
                    <UpNextRow item={t} ep={idx + 1} />
                  </li>
                ))
              )}
            </ul>
          </aside>
        </div>
      </section>

      {/* =========== LORE SPOTLIGHT ============ */}
      <section
        className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12"
        aria-labelledby="uf-lore-spotlight-title"
      >
        <ScrollReveal>
          <SectionHeader
            eyebrow="Lore Spotlight"
            title="// Encyclopedia entries."
            icon={<BookOpen className="h-4 w-4" />}
            action={
              <Link to="/lore" className="uf-btn uf-btn--ghost">
                <span>Open Channel</span>
                <ChevronRight className="h-4 w-4 ml-1 inline-block" />
              </Link>
            }
          />
        </ScrollReveal>
        <h2 id="uf-lore-spotlight-title" className="sr-only">
          Lore Spotlight
        </h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {featuredLore === undefined ? (
            [0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 220 }} />
            ))
          ) : featuredLore.length === 0 ? (
            <div className="uf-empty md:col-span-3">
              No lore entries pinned. Operators can feature them from the
              Content Desk.
            </div>
          ) : (
            featuredLore.map((entry, i) => (
              <Link key={entry._id} to={`/lore/${entry.slug}`} className="block">
                <article className="rounded-md border border-[color:var(--uf-border)] overflow-hidden">
                  <div
                    className="h-32 relative"
                    aria-hidden
                  >
                    {entry.coverUrl ? (
                      <img
                        src={entry.coverUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="absolute inset-0"
                        style={{ background: coverAt(i + 2) }}
                      />
                    )}
                    <span
                      className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.18em]"
                      style={{
                        background: "rgba(0,0,0,0.45)",
                        padding: "4px 10px",
                        borderRadius: 999,
                        color: "var(--uf-text)",
                      }}
                    >
                      {entry.classification ?? "Archive"}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="text-xl font-semibold">{entry.title}</h3>
                    <p className="text-uf-muted text-sm mt-2 line-clamp-3">
                      {entry.excerpt}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {entry.faction ? (
                        <StatusPill variant="info">{entry.faction}</StatusPill>
                      ) : null}
                      {entry.sector ? (
                        <StatusPill variant="violet">{entry.sector}</StatusPill>
                      ) : null}
                      {entry.entryType ? (
                        <StatusPill variant="default">{entry.entryType}</StatusPill>
                      ) : null}
                    </div>
                  </div>
                </article>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* =========== FEATURED ARTWORK (Canon Image Library) ============ */}
      {featuredArt !== undefined && featuredArt.length > 0 ? (
        <section
          className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12"
          aria-labelledby="uf-featured-art-title"
        >
          <ScrollReveal>
            <SectionHeader
              eyebrow="Canon Image Library"
              title="// Featured artwork."
              icon={<Images className="h-4 w-4" />}
              action={
                <Link to="/canon-images" className="uf-btn uf-btn--ghost">
                  <span>Open gallery</span>
                  <ChevronRight className="h-4 w-4 ml-1 inline-block" />
                </Link>
              }
            />
          </ScrollReveal>
          <h2 id="uf-featured-art-title" className="sr-only">
            Featured artwork
          </h2>
          <div className="mt-6 grid gap-5 grid-cols-2 lg:grid-cols-4">
            {featuredArt.slice(0, 4).map((a) => (
              <Link key={a._id} to="/canon-images" className="group block">
                <article className="rounded-md border border-[color:var(--uf-border)] overflow-hidden sf-glass">
                  <div className="h-36 overflow-hidden">
                    <img
                      src={a.url ?? undefined}
                      alt={a.title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-semibold truncate">{a.title}</h3>
                    <p className="text-xs text-uf-muted truncate mt-1">
                      {a.attribution || "Fleet artist"}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* =========== FROM THE COMMUNITY ============ */}
      <section
        className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12"
        aria-labelledby="uf-community-title"
      >
        <ScrollReveal>
          <SectionHeader
            eyebrow="From the Community"
            title="// Real-time chatter."
            icon={<Users className="h-4 w-4" />}
          />
        </ScrollReveal>
        <h2 id="uf-community-title" className="sr-only">
          From the Community
        </h2>
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <CommunityColumn title="Forum Discussions">
            {forumThreads === undefined ? (
              <SkeletonRows count={3} />
            ) : forumThreads.length === 0 ? (
              <Empty label="No threads yet." />
            ) : (
              forumThreads.map((t, idx) => (
                <li key={t._id}>
                  <Link to={`/forums?thread=${t.slug}`} className="block">
                    <HoloCard className="!p-3" reveal staggerIndex={idx}>
                      <h4 className="text-base font-semibold">{t.title}</h4>
                      <p className="text-uf-muted text-xs mt-1">
                        {t.replyCount ?? 0} replies ·{" "}
                        <span className="text-uf-green">{timeAgo(t.lastActivityAt)}</span>
                      </p>
                    </HoloCard>
                  </Link>
                </li>
              ))
            )}
          </CommunityColumn>

          <CommunityColumn title="Fleet Groups">
            {groups === undefined ? (
              <SkeletonRows count={3} />
            ) : groups.length === 0 ? (
              <Empty label="No groups yet." />
            ) : (
              [...groups]
                .sort(
                  (a, b) =>
                    (b.latestActivityAt ?? b.createdAt ?? 0) -
                    (a.latestActivityAt ?? a.createdAt ?? 0),
                )
                .slice(0, 3)
                .map((g, idx) => (
                  <li key={g._id}>
                    <Link to={`/groups/${g.slug}`} className="block">
                      <HoloCard className="!p-3" reveal staggerIndex={idx}>
                        <h4 className="text-base font-semibold">{g.name}</h4>
                        <p className="text-uf-muted text-xs mt-1">
                          {g.memberCount ?? 0} members · {g.privacy} ·{" "}
                          <span className="text-uf-green">
                            {timeAgo(g.latestActivityAt)}
                          </span>
                        </p>
                      </HoloCard>
                    </Link>
                  </li>
                ))
            )}
          </CommunityColumn>

          <CommunityColumn title="Leaderboard">
            {topCadets === undefined ? (
              <SkeletonRows count={3} />
            ) : topCadets.length === 0 ? (
              <Empty label="No rankings yet." />
            ) : (
              topCadets.map((u, idx) => {
                const rankTone =
                  idx === 0
                    ? { color: "var(--uf-gold)", ring: "rgba(230,168,23,0.40)" }
                    : idx === 1
                      ? {
                          color: "var(--uf-violet)",
                          ring: "rgba(139,92,246,0.40)",
                        }
                      : {
                          color: "var(--uf-cyan)",
                          ring: "rgba(0,229,255,0.40)",
                        };
                return (
                  <li key={u._id}>
                    <Link to={`/u/${u._id}`} className="block">
                      <HoloCard className="!p-3 flex items-center gap-3" reveal staggerIndex={idx}>
                        <span
                          aria-label={`Rank ${idx + 1}`}
                          className="font-mono text-2xl tabular-nums shrink-0 w-9 h-9 rounded-md flex items-center justify-center"
                          style={{
                            color: rankTone.color,
                            background: "rgba(0,0,0,0.35)",
                            boxShadow: `inset 0 0 0 1px ${rankTone.ring}`,
                          }}
                        >
                          {idx === 0 ? (
                            <Crown className="h-4 w-4" />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-base font-semibold truncate">
                            {u.displayName ?? u.name ?? "—"}
                          </h4>
                        </div>
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"
                          style={{
                            color: rankTone.color,
                            borderColor: rankTone.color,
                          }}
                          aria-label={`Experience: ${(u.xp ?? 0).toLocaleString()} XP`}
                        >
                          {(u.xp ?? 0).toLocaleString()}
                        </span>
                      </HoloCard>
                    </Link>
                  </li>
                );
              })
            )}
            <Link
              to="/leaderboard"
              className="uf-btn uf-btn--ghost mt-3 w-full"
            >
              Full leaderboard
            </Link>
          </CommunityColumn>
        </div>
      </section>

      {/* =========== SIGNAL LOG — fleet testimonials ============ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <span className="uf-eyebrow">The Signal Log</span>
            <h2 className="text-3xl font-semibold mt-2">
              What the fleet says after the debrief.
            </h2>
            <p className="text-uf-muted text-sm mt-2 max-w-2xl">
              Transmissions from operators with a name, a call sign, and time
              on the base. Published as sent, with permission.
            </p>
          </div>
          <Link to="/reviews">
            <NeonButton variant="ghost">Open the full log</NeonButton>
          </Link>
        </header>
        <div className="uf-grid uf-grid--3">
          {REVIEWS.slice(0, 3).map((review, idx) => (
            <ScaleReveal key={review.id} staggerIndex={idx}>
              <HoloCard className="flex h-full flex-col">
                <span
                  className="text-xs text-[var(--uf-gold)]"
                  aria-label={`${review.rating} out of 5 stars`}
                >
                  {"★".repeat(review.rating)}
                  {"☆".repeat(Math.max(0, 5 - review.rating))}
                </span>
                <h3 className="mt-3 text-base font-semibold leading-6">
                  {review.headline}
                </h3>
                <p className="text-uf-muted mt-2 flex-1 text-sm leading-6">
                  {review.quote}
                </p>
                <footer className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold">{review.name}</span>
                  <span className="text-xs text-[var(--uf-cyan)]">
                    “{review.callSign}”
                  </span>
                  <span className="text-xs text-uf-muted">{review.role}</span>
                </footer>
              </HoloCard>
            </ScaleReveal>
          ))}
        </div>
        <p className="text-uf-muted mt-4 text-xs">
          {reviewAggregate().ratingValue.toFixed(1)} / 5 across{" "}
          {reviewAggregate().reviewCount} logged transmissions ·{" "}
          <Link to="/reviews" className="text-[var(--uf-cyan)]">
            read every one
          </Link>
        </p>
      </section>

      {/* =========== CONTINUE — slim CTA strip ============ */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pb-20">
        <ScaleReveal>
          <div
            className="rounded-md border border-[color:var(--uf-border)] p-6 md:p-10 relative overflow-hidden grid gap-6 md:grid-cols-[1fr_auto] items-center"
            style={{
              background:
                "radial-gradient(700px 360px at 30% 50%, rgba(0,229,255,0.16), transparent 65%), linear-gradient(135deg, rgba(0,229,255,0.10), rgba(139,92,246,0.10))",
            }}
          >
            <div className="relative">
              <span className="uf-eyebrow">Continue your mission</span>
              <h2 className="text-3xl md:text-4xl font-semibold mt-2">
                {VOICE.heroTitle}.
              </h2>
              <p className="text-uf-muted text-sm mt-2 max-w-xl">
                {VOICE.heroLead}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 relative justify-start md:justify-end">
              <Link to="/auth">
                <NeonButton variant="primary">Join the Fleet</NeonButton>
              </Link>
              <Link to="/community">
                <NeonButton variant="ghost">Open Command</NeonButton>
              </Link>
            </div>
          </div>
        </ScaleReveal>
      </section>
    </SiteShell>
  );
}

// =========================================================================
// Subcomponents
// =========================================================================

function LiveFromTheFleetPanel({
  primaryStory,
  fleetUpdate,
  onlineNow,
  totalCadets,
}: {
  primaryStory: null | { _id: string; title: string; slug: string };
  fleetUpdate: null | { _id: string; title: string };
  onlineNow: number;
  totalCadets: number;
}) {
  return (
    <aside
      aria-label="Live from the Fleet"
      className="rounded-md border border-[color:var(--uf-border)] p-4 lg:p-5 relative overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, rgba(0,229,255,0.08), rgba(139,92,246,0.08) 60%, rgba(16,24,39,0.65))",
      }}
    >
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-uf-cyan">
          Live from the Fleet
        </h2>
        <span className="inline-flex items-center gap-1 text-uf-cyan text-[10px] uppercase tracking-[0.18em]">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--uf-green)", boxShadow: "0 0 8px var(--uf-green)" }}
          />
          Live
        </span>
      </header>

      <Link
        to={primaryStory ? `/stories/${primaryStory.slug}` : "/stories"}
        className="block rounded-md p-3 relative overflow-hidden h-[88px]"
        aria-label={`Featured story: ${primaryStory?.title ?? "Browse stories"}`}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(110deg, rgba(0,229,255,0.45) 0%, rgba(139,92,246,0.45) 60%, rgba(255,61,242,0.40) 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        <div className="relative h-full flex flex-col justify-end">
          <span
            className="text-[10px] uppercase tracking-[0.18em] text-white/85"
            style={{ textShadow: "0 1px 1px rgba(0,0,0,0.6)" }}
          >
            Featured Story
          </span>
          <h3
            className="text-white font-semibold mt-1 line-clamp-2"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.65)" }}
          >
            {primaryStory?.title ?? "Echoes of the Starforge"}
          </h3>
        </div>
      </Link>

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 items-center p-3 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.55)]">
        <div className="min-w-0">
          <span className="uf-eyebrow">Galactic War Update</span>
          <p className="text-uf-text text-sm font-medium mt-1 truncate">
            {fleetUpdate?.title ?? "FleetCam Roster in the field"}
          </p>
          <p className="text-uf-muted text-xs mt-0.5">
            Mission brief · live from the bridge
          </p>
        </div>
        <Radio className="h-5 w-5 text-uf-cyan" aria-hidden />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <MiniStat
          label="Online Now"
          value={onlineNow}
          tone="var(--uf-green)"
          icon={<Compass className="h-3.5 w-3.5" />}
        />
        <MiniStat
          label="Total Cadets"
          value={totalCadets}
          tone="var(--uf-cyan)"
          icon={<Globe className="h-3.5 w-3.5" />}
          align="right"
        />
      </div>
    </aside>
  );
}

function MiniStat({
  label,
  value,
  tone,
  icon,
  align = "left",
}: {
  label: string;
  value: number;
  tone: string;
  icon?: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <div
      className={
        "rounded-md border border-[color:var(--uf-border)] p-3 bg-[rgba(16,24,39,0.55)] " +
        (align === "right" ? "text-right" : "")
      }
    >
      <span
        className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em]"
        style={{ color: tone }}
      >
        {icon}
        {label}
      </span>
      <p
        className="font-mono text-2xl font-semibold mt-1 tabular-nums"
        style={{ color: tone }}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function FeaturedStoryCard({
  story,
  coverIndex,
  eyebrow,
  meta,
  large,
}: {
  story: {
    _id: string;
    slug: string;
    title: string;
    excerpt: string;
    coverUrl?: string | null;
  };
  coverIndex: number;
  eyebrow: string;
  meta: string;
  large?: boolean;
}) {
  return (
    <Link to={`/stories/${story.slug}`} className="block">
      <article className="rounded-md border border-[color:var(--uf-border)] overflow-hidden">
        <div
          className={large ? "h-44 relative" : "h-32 relative"}
          aria-hidden
        >
          {story.coverUrl ? (
            <img
              src={story.coverUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: coverAt(coverIndex) }}
            />
          )}
          <span
            className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.18em]"
            style={{
              background: "rgba(0,0,0,0.45)",
              padding: "4px 10px",
              borderRadius: 999,
              color: "var(--uf-text)",
            }}
          >
            {eyebrow}
          </span>
        </div>
        <div className="p-4">
          <h3 className={large ? "text-xl font-semibold" : "text-lg font-semibold"}>
            {story.title}
          </h3>
          <p className="text-uf-muted text-xs mt-2">{meta}</p>
        </div>
      </article>
    </Link>
  );
}

function FeaturedStoryCardSkeleton({ height }: { height: number }) {
  return (
    <div className="rounded-md border border-[color:var(--uf-border)] overflow-hidden">
      <div className="uf-skeleton" style={{ height }} />
    </div>
  );
}

function FeaturedStoryPlaceholder({
  title,
  hint,
  coverIndex,
  large,
}: {
  title: string;
  hint: string;
  coverIndex: number;
  large?: boolean;
}) {
  return (
    <div
      className="rounded-md border border-[color:var(--uf-border)] p-6 flex flex-col justify-end relative overflow-hidden"
      style={{ background: coverAt(coverIndex), minHeight: large ? 260 : 200 }}
      aria-label={`Empty ${title} slot`}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <div className="relative">
        <span className="uf-eyebrow">Featured Story</span>
        <h3 className="text-xl font-semibold mt-1">{title}</h3>
        <p className="text-uf-muted text-xs mt-2">{hint}</p>
      </div>
    </div>
  );
}

function buildStoryMeta(story: {
  factions?: string[];
  sectors?: string[];
  classification?: string;
  readMinutes?: number;
}): string {
  const bits: string[] = [];
  if (story.factions?.length) bits.push(`Factions · ${story.factions.join(", ")}`);
  if (story.readMinutes) bits.push(`~${story.readMinutes} min`);
  if (story.classification) bits.push(story.classification);
  return bits.join(" · ");
}

function UpNextRow({
  item,
  ep,
}: {
  item: { _id: string; title: string; transmissionType?: string };
  ep: number;
}) {
  return (
    <article className="rounded-md border border-[color:var(--uf-border)] p-3 grid grid-cols-[1fr_auto] gap-3 items-center">
      <div className="min-w-0">
        <span className="uf-eyebrow">Ep {String(ep).padStart(2, "0")}</span>
        <h4 className="text-base font-semibold mt-1 truncate">{item.title}</h4>
        <p className="text-uf-muted text-xs mt-1 truncate">
          {item.transmissionType ?? "briefing"} · latest transmission
          {ep === 1 ? "" : ""}
        </p>
      </div>
      <ArrowRight
        className="h-4 w-4 text-uf-muted shrink-0"
        aria-hidden
      />
    </article>
  );
}

// Relative "last activity" label — keeps the community cards feeling live.
function timeAgo(ts?: number): string {
  if (!ts) return "no recent activity";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CommunityColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-md border border-[color:var(--uf-border)] p-4 bg-[rgba(16,24,39,0.55)]"
      aria-label={title}
    >
      <header className="flex items-center justify-between mb-3">
        <h3 className="uf-eyebrow">{title}</h3>
        <ChevronRight className="h-4 w-4 text-uf-muted" aria-hidden />
      </header>
      <ul className="flex flex-col gap-2 list-none p-0 m-0">{children}</ul>
    </section>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <div className="uf-skeleton" style={{ height: 56 }} />
        </li>
      ))}
    </>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <li>
      <div className="uf-empty">{label}</div>
    </li>
  );
}
