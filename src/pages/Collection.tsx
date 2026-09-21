import { useMemo } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import {
  BookMarked,
  Compass,
  Package,
  ShoppingBag,
  Sparkles,
  Trophy,
  UserCircle,
} from "lucide-react";
import { MyLocker } from "@/components/widgets/LockerPanel";
import { RibbonRack } from "@/components/widgets/RibbonRack";

// ---------------------------------------------------------------------------
// Member Collection — the binder. One page surfacing everything a member has
// gathered on the base: owned cosmetics, store artifacts & entitlements,
// codex bookmarks, earned badges, and worlds explored. The "collection" half
// of lore immersion, finally surfaced.
// ---------------------------------------------------------------------------

export default function Collection() {
  const { isLoading, isAuthenticated, user } = useAuth();
  usePageMeta({
    title: "My Collection — Star Force Base 1198",
    description: "Your personal binder of cosmetics, artifacts, codex saves, badges, and explored worlds.",
  });

  const ent = useQuery(
    api.store.myEntitlements,
    isAuthenticated ? {} : "skip",
  );
  const orders = useQuery(api.store.myOrders, isAuthenticated ? {} : "skip");
  const codex = useQuery(api.engagement.listCodex, isAuthenticated ? {} : "skip");
  const visits = useQuery(api.engagement.myAtlasVisits, isAuthenticated ? {} : "skip");
  const streak = useQuery(api.engagement.myStreak, isAuthenticated ? {} : "skip");
  const referral = useQuery(api.engagement.myReferral, isAuthenticated ? {} : "skip");
  const rack = useQuery(api.honors.memberRibbonRack, isAuthenticated ? { userId: user?._id as any } : "skip");

  const frame = user?.frame;
  const title = user?.title;
  const badges = user?.achievements ?? [];
  const ownedFrames = user?.frames ?? [];
  const ownedTitles = user?.titles ?? [];

  const stats = useMemo(
    () => ({
      cosmetics: ownedFrames.length + ownedTitles.length,
      artifacts: (ent ?? []).length,
      codex: (codex ?? []).length,
      worlds: (visits ?? []).length,
      badges: badges.length,
    }),
    [ownedFrames, ownedTitles, ent, codex, visits, badges],
  );

  if (isLoading) {
    return (
      <SiteShell>
        <div className="uf-section max-w-[1100px] mx-auto px-4 flex justify-center">
          <div className="uf-skeleton" style={{ height: 200, width: "100%" }} />
        </div>
      </SiteShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <SiteShell>
        <div className="uf-section max-w-[720px] mx-auto px-4 text-center">
          <Package className="h-10 w-10 mx-auto text-uf-muted" aria-hidden />
          <h1 className="text-2xl font-semibold mt-4">Your collection lives here.</h1>
          <p className="text-uf-muted mt-2">
            Sign in to see your cosmetics, artifacts, codex saves, badges, and the worlds
            you've charted — everything you've earned on the base, in one binder.
          </p>
          <Link to="/auth?returnTo=/collection" className="inline-block mt-6">
            <NeonButton variant="primary">Sign in to open your binder</NeonButton>
          </Link>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow="Service Record Annex"
        title="Your Collection."
        lead="Everything you've earned, saved, and charted — your identity, your artifacts, your chapter of the galaxy."
        primary={{ label: "Earn more at the Lab", href: "/account#cosmetic-lab", variant: "primary" }}
        secondary={{ label: "Requisition Depot", href: "/store", variant: "ghost" }}
      />

      {/* ---- Totals strip ---- */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Cosmetics", value: stats.cosmetics, icon: Sparkles },
            { label: "Artifacts", value: stats.artifacts, icon: Package },
            { label: "Codex saves", value: stats.codex, icon: BookMarked },
            { label: "Worlds charted", value: stats.worlds, icon: Compass },
            { label: "Badges", value: stats.badges, icon: Trophy },
          ].map((s) => (
            <HoloCard key={s.label} className="!p-4 text-center">
              <s.icon className="h-5 w-5 mx-auto text-uf-cyan" aria-hidden />
              <p className="text-2xl font-semibold mt-1 tabular-nums">{s.value}</p>
              <p className="uf-eyebrow mt-1">{s.label}</p>
            </HoloCard>
          ))}
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 grid gap-6 lg:grid-cols-2">
        {/* ---- Identity: equipped cosmetics ---- */}
        <section aria-labelledby="col-identity">
          <h2 id="col-identity" className="uf-eyebrow mb-3">
            Identity
          </h2>
          <HoloCard>
            <div className="flex items-start gap-4">
              <UserCircle className="h-10 w-10 text-uf-cyan shrink-0" aria-hidden />
              <div className="min-w-0">
                <h3 className="text-lg font-semibold">{user?.displayName ?? user?.name}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {frame ? (
                    <StatusPill variant="cyan">Frame: {frame}</StatusPill>
                  ) : (
                    <span className="text-uf-muted text-sm">No frame equipped</span>
                  )}
                  {title ? <StatusPill variant="violet">{title}</StatusPill> : null}
                </div>
                <p className="text-uf-muted text-sm mt-3">
                  {ownedFrames.length} frame{ownedFrames.length === 1 ? "" : "s"} and{" "}
                  {ownedTitles.length} title{ownedTitles.length === 1 ? "" : "s"} owned. Equip
                  them from the Cosmetic Lab.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {ownedFrames.map((f) => (
                    <span key={f} className="uf-pill">
                      {f}
                    </span>
                  ))}
                  {ownedTitles.map((t) => (
                    <span key={t} className="uf-pill">
                      {t}
                    </span>
                  ))}
                </div>
                <Link to="/account" className="inline-block mt-4">
                  <NeonButton variant="ghost">Open the Cosmetic Lab</NeonButton>
                </Link>
              </div>
            </div>
          </HoloCard>
        </section>

        {/* ---- Artifacts: store entitlements ---- */}
        <section aria-labelledby="col-artifacts">
          <h2 id="col-artifacts" className="uf-eyebrow mb-3">
            Artifacts & requisitions
          </h2>
          <HoloCard>
            {ent === undefined ? (
              <div className="uf-skeleton" style={{ height: 96 }} />
            ) : ent.length === 0 ? (
              <div className="text-center py-4">
                <Package className="h-8 w-8 mx-auto text-uf-muted" aria-hidden />
                <p className="text-uf-muted text-sm mt-2">
                  No artifacts yet. Missions, the Depot, and lore arcs all grant collectibles.
                </p>
                <Link to="/store" className="inline-block mt-3">
                  <NeonButton variant="ghost">
                    <ShoppingBag className="h-4 w-4" aria-hidden /> Visit the Depot
                  </NeonButton>
                </Link>
              </div>
            ) : (
              <ul className="space-y-2 list-none p-0 m-0">
                {ent.map((e) => (
                  <li
                    key={e._id}
                    className="flex items-center justify-between gap-3 text-sm border-b border-[color:var(--uf-border)] pb-2 last:border-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate">{e.product?.title ?? "Requisition"}</span>
                    <span className="text-uf-muted text-xs shrink-0">
                      {new Date(e.grantedAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {orders !== undefined && orders.length > 0 && (
              <p className="uf-eyebrow mt-4">{orders.length} total requisition{orders.length === 1 ? "" : "s"}</p>
            )}
          </HoloCard>
        </section>

        {/* ---- Codex saves ---- */}
        <section aria-labelledby="col-codex">
          <h2 id="col-codex" className="uf-eyebrow mb-3">
            Personal codex
          </h2>
          <HoloCard>
            {codex === undefined ? (
              <div className="uf-skeleton" style={{ height: 96 }} />
            ) : codex.length === 0 ? (
              <div className="text-center py-4">
                <BookMarked className="h-8 w-8 mx-auto text-uf-muted" aria-hidden />
                <p className="text-uf-muted text-sm mt-2">
                  Bookmark lore and stories from their detail pages — they collect here.
                </p>
                <Link to="/lore" className="inline-block mt-3">
                  <NeonButton variant="ghost">Browse the archive</NeonButton>
                </Link>
              </div>
            ) : (
              <ul className="space-y-2 list-none p-0 m-0">
                {codex.map((c) => (
                  <li key={c._id} className="border-b border-[color:var(--uf-border)] pb-2 last:border-0 last:pb-0">
                    <Link
                      to={c.entryType === "story" ? `/stories/${c.slug}` : `/lore/${c.slug}`}
                      className="text-sm hover:text-uf-cyan transition-colors"
                    >
                      {c.title}
                    </Link>
                    <span className="text-uf-muted text-xs ml-2 uppercase tracking-[0.16em]">
                      {c.entryType}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </HoloCard>
        </section>

        {/* ---- Exploration + engagement ---- */}
        <section aria-labelledby="col-explore">
          <h2 id="col-explore" className="uf-eyebrow mb-3">
            Exploration & service
          </h2>
          <HoloCard>
            {visits === undefined ? (
              <div className="uf-skeleton" style={{ height: 96 }} />
            ) : visits.length === 0 ? (
              <div className="text-center py-4">
                <Compass className="h-8 w-8 mx-auto text-uf-muted" aria-hidden />
                <p className="text-uf-muted text-sm mt-2">
                  You haven't charted any worlds yet. Click a sector on the Star Atlas and it's
                  logged to your record.
                </p>
                <Link to="/map" className="inline-block mt-3">
                  <NeonButton variant="ghost">Chart the atlas</NeonButton>
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {visits.map((v) => (
                  <Link
                    key={v._id}
                    to={`/lore?sector=${encodeURIComponent(v.sectorName)}`}
                    className="uf-pill hover:shadow-[var(--uf-glow-cyan)]"
                  >
                    {v.sectorName}
                  </Link>
                ))}
              </div>
            )}
            {streak && streak.streak > 0 && (
              <p className="uf-eyebrow mt-4">
                {streak.streak}-day streak · best {streak.best} · check in daily for credits
              </p>
            )}
            {referral?.code && (
              <p className="uf-eyebrow mt-2">
                Recruitment code: <span className="text-uf-cyan">{referral.code}</span> ·{" "}
                {referral.count} recruit{referral.count === 1 ? "" : "s"} activated
              </p>
            )}
          </HoloCard>
        </section>
      </div>

      {/* ---- Ribbon rack ---- */}
      <section aria-labelledby="col-rack" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-10 pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 id="col-rack" className="uf-eyebrow">
            Ribbon rack
          </h2>
          <Link to="/awards" className="text-uf-cyan text-xs hover:underline">
            Decorations catalog →
          </Link>
        </div>
        <RibbonRack entries={rack ?? []} />
      </section>

      {/* ---- Quartermaster's Locker ---- */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-8 pb-2">
        <MyLocker />
      </section>

      {/* ---- Badges ---- */}
      <section aria-labelledby="col-badges" className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-8 pb-16">
        <h2 id="col-badges" className="uf-eyebrow mb-3">
          Earned badges
        </h2>
        <HoloCard>
          {badges.length === 0 ? (
            <p className="text-uf-muted text-sm">
              No badges yet — complete your First Watch and file contributions to start the
              display.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <StatusPill key={b} variant="gold">
                  {b}
                </StatusPill>
              ))}
            </div>
          )}
        </HoloCard>
      </section>
    </SiteShell>
  );
}
