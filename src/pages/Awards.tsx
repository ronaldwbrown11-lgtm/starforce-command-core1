import { SiteShell, PageHero, HoloCard } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { AwardsCatalog } from "@/components/widgets/RibbonRack";
import { LockerManifest } from "@/components/widgets/LockerPanel";
import { Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { NeonButton } from "@/components/uf";
import { Feather } from "lucide-react";

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
                <Link to="/fleet-registry">
                  <NeonButton variant="gold">See the assigned pilots</NeonButton>
                </Link>
                <span className="text-xs text-uf-muted">
                  The ceremony opens only through a personal claim link — watch
                  for yours when the Bridge awards wings.
                </span>
              </div>
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
