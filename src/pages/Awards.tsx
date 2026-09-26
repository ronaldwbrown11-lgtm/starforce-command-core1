import { useState } from "react";
import { SiteShell, PageHero, HoloCard } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { AwardsCatalog } from "@/components/widgets/RibbonRack";
import { LockerManifest } from "@/components/widgets/LockerPanel";
import { Link, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { NeonButton } from "@/components/uf";
import { Feather } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// /awards — the decoration board. Public catalog of every service ribbon,
// achievement badge, and medal the fleet confers, plus the Quartermaster's
// Locker manifest of collectible digital assets. Members view their own
// rack and locker from their profile and Collection binder.
// ---------------------------------------------------------------------------

export default function Awards() {
  usePageMeta({
    title: "Awards & Honors — Star Force Base 1198",
    description:
      "Service ribbons, achievement badges, medals, the Wings ceremony, and the Quartermaster's Locker — the decorations and collectible assets of the Star Force fleet.",
  });
  const { isAuthenticated } = useAuth();

  return (
    <SiteShell>
      <PageHero
        eyebrow="Decorations & Assets"
        title="Awards & Honors."
        lead="Every decoration the fleet confers, and every collectible asset the Quartermaster issues — earned through verified contribution, displayed on your service record."
        primary={
          isAuthenticated
            ? { label: "View your collection", href: "/collection", variant: "primary" }
            : { label: "Join the fleet", href: "/auth?returnTo=/awards", variant: "primary" }
        }
        secondary={{ label: "The Locker manifest", href: "#locker", variant: "ghost" }}
      />

      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-10 pb-4">
        <header className="mb-6">
          <span className="uf-eyebrow">Order of precedence</span>
          <h2 className="text-3xl font-semibold mt-2 tracking-tight">
            The decorations of the fleet.
          </h2>
          <p className="text-uf-muted mt-2 max-w-3xl">
            Honors are conferred by the Bridge — never bought, never traded. They attach to
            your service record and render on your dossier's ribbon rack. Medals outrank
            ribbons; ribbons outrank badges; precedence orders each row.
          </p>
        </header>
        <AwardsCatalog />
      </section>

      <section
        id="wings"
        className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-6 pb-4 scroll-mt-24"
      >
        <HoloCard className="border-[rgba(255,204,0,0.35)]" glow>
          <div className="flex flex-wrap items-start gap-6">
            <div className="h-12 w-12 shrink-0 rounded-full border border-[rgba(255,204,0,0.45)] bg-[rgba(255,204,0,0.08)] flex items-center justify-center">
              <Feather className="h-5 w-5 text-[#ffcc00]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <span className="uf-eyebrow">The permanent honor</span>
              <h2 className="text-2xl font-semibold mt-1.5 tracking-tight">
                Wings are earned — then they are forever.
              </h2>
              <p className="text-uf-muted text-sm mt-2 max-w-3xl leading-6">
                Wings are the one decoration you choose yourself. When the Bridge
                decides your contribution has earned them, you receive a personal
                claim link that opens the Wings ceremony: pick the fighter you will
                fly, and your name is written permanently on that hull's ASSIGNED
                PILOTS honor roll. It can never be changed, traded, or revoked —
                that permanence is the reward.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Link to="/wings/pilots">
                  <NeonButton variant="gold">See the assigned pilots</NeonButton>
                </Link>
                <span className="text-xs text-uf-muted">
                  The ceremony opens only through a personal claim link — watch
                  for yours when the Bridge awards wings.
                </span>
              </div>
              <WingsEligibility />
            </div>
          </div>
        </HoloCard>
      </section>

      <section
        id="locker"
        className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-6 pb-16 scroll-mt-24"
      >
        <header className="mb-6">
          <span className="uf-eyebrow">Digital trading & collection</span>
          <h2 className="text-3xl font-semibold mt-2 tracking-tight">
            The Quartermaster's Locker.
          </h2>
          <p className="text-uf-muted mt-2 max-w-3xl">
            Collectible digital assets — blueprint schematics, high-resolution unit insignia
            patches, classified technical manuals, and rare artifacts. Held assets showcase on
            your public dossier; transfers between members are brokered by the Quartermaster,
            so every asset is provably unique.
          </p>
        </header>
        <LockerManifest />

        <HoloCard className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-uf-muted text-sm max-w-xl">
              Assets arrive in your Locker from operations, events, and Bridge grants — and
              they stay yours to showcase. Open your binder to see what you hold.
            </p>
            <Link to={isAuthenticated ? "/collection" : "/auth?returnTo=/collection"}>
              <NeonButton variant="primary">
                {isAuthenticated ? "Open my Locker" : "Sign in to collect"}
              </NeonButton>
            </Link>
          </div>
        </HoloCard>
      </section>
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// Wings eligibility — the member-facing earning rule. Wings are awarded by
// the Bridge (contests, certified field reports, direct issuance), but any
// member who reaches CAPTAIN rank (2,500 XP) of verified service may claim
// their wings themselves. The ceremony's permanence is unchanged.
// ---------------------------------------------------------------------------

function WingsEligibility() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const claim = useQuery(api.wings.getMyWingsClaim, isAuthenticated ? {} : "skip");
  const selfClaim = useMutation(api.wings.selfClaimWings);
  const [busy, setBusy] = useState(false);

  if (!isAuthenticated) return null;
  if (claim === undefined) return null;

  async function claimWings() {
    setBusy(true);
    try {
      const res = await selfClaim({});
      navigate(`/wings?claim=${encodeURIComponent(res.token)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Claim failed.");
      setBusy(false);
    }
  }

  if (claim?.hasOutstandingClaim && claim.claimToken) {
    return (
      <div className="mt-5 rounded-md border border-[rgba(255,204,0,0.45)] bg-[rgba(255,204,0,0.07)] p-4">
        <p className="font-semibold flex items-center gap-2 text-sm">
          <Feather className="h-4 w-4 text-[#ffcc00]" aria-hidden />
          Your wings are waiting to be claimed.
        </p>
        <p className="text-sm text-uf-muted mt-1">
          The Bridge has issued your ceremony link. Choose your fighter — the
          choice is permanent.
        </p>
        <Link
          to={`/wings?claim=${encodeURIComponent(claim.claimToken)}`}
          className="uf-btn uf-btn--gold mt-3 inline-block text-sm"
        >
          Open the Wings ceremony
        </Link>
      </div>
    );
  }

  // Two self-serve paths, both Bridge-tunable: XP rank or certified reports.
  const xpRemaining = claim ? Math.max(0, claim.xpThreshold - claim.xp) : 0;
  const xpPct = claim && claim.xpThreshold > 0
    ? Math.min(100, Math.round((claim.xp / claim.xpThreshold) * 100))
    : 0;
  const reportsRemaining = claim
    ? Math.max(0, claim.reportThreshold - claim.certifiedCount)
    : 0;
  const reportsPct = claim && claim.reportThreshold > 0
    ? Math.min(100, Math.round((claim.certifiedCount / claim.reportThreshold) * 100))
    : 0;

  return (
    <div className="mt-5 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-4">
      <p className="font-semibold flex items-center gap-2 text-sm">
        <Feather className="h-4 w-4 text-[#ffcc00]" aria-hidden />
        {claim?.eligible ? "You have earned your wings." : "Earning your wings."}
      </p>
      {claim?.eligible ? (
        <>
          <p className="text-sm text-uf-muted mt-1">
            Your verified service qualifies — claim your ceremony link and make
            the permanent choice.
          </p>
          <NeonButton variant="gold" className="mt-3" loading={busy} onClick={claimWings}>
            Claim your wings
          </NeonButton>
        </>
      ) : (
        <>
          <p className="text-sm text-uf-muted mt-1">
            Qualify by either path — or earn wings outright by winning a
            wings-prize contest, from a certified field report grant, or a
            direct Bridge award.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 max-w-xl">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-uf-muted">
                {claim?.xpRank ?? "Captain"} rank · {claim?.xpThreshold ?? 2500} XP
              </p>
              <p className="text-sm mt-0.5">
                {claim?.xpEligible ? (
                  <span className="text-[#ffcc00]">Reached — path open</span>
                ) : (
                  <>
                    <span className="text-uf-text">{claim?.xp ?? 0} XP</span>{" "}
                    <span className="text-uf-muted">· {xpRemaining} to go</span>
                  </>
                )}
              </p>
              <div
                className="mt-2 h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={xpPct}
                aria-label="XP progress toward wings eligibility"
              >
                <div
                  className="h-full rounded-full bg-[#ffcc00] transition-all"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
            </div>
            {claim && claim.reportThreshold > 0 ? (
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-uf-muted">
                  Certified field reports · {claim.reportThreshold}
                </p>
                <p className="text-sm mt-0.5">
                  {claim.reportsEligible ? (
                    <span className="text-[#ffcc00]">Reached — path open</span>
                  ) : (
                    <>
                      <span className="text-uf-text">{claim.certifiedCount} certified</span>{" "}
                      <span className="text-uf-muted">· {reportsRemaining} to go</span>
                    </>
                  )}
                </p>
                <div
                  className="mt-2 h-1.5 w-full rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={reportsPct}
                  aria-label="Certified report progress toward wings eligibility"
                >
                  <div
                    className="h-full rounded-full bg-[#00e5ff] transition-all"
                    style={{ width: `${reportsPct}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
