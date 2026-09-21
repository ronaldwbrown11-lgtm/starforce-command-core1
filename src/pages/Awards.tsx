import { SiteShell, PageHero, HoloCard } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { AwardsCatalog } from "@/components/widgets/RibbonRack";
import { LockerManifest } from "@/components/widgets/LockerPanel";
import { Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { NeonButton } from "@/components/uf";

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
      "Service ribbons, achievement badges, medals, and the Quartermaster's Locker — the decorations and collectible assets of the Star Force fleet.",
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
