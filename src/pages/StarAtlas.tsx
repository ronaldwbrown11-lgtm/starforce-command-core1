import { Suspense, lazy } from "react";
import { SiteShell, PageHero, GlassPanel } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useFactionCanonSync } from "@/hooks/use-faction-canon-sync";
import { SectorClaims } from "@/components/widgets/SectorClaims";

// =========================================================================
// Star Atlas — the native galaxy view. Quadrants, sectors, star systems,
// star lore and warp lanes render in a real-time 3D galaxy, straight from
// this project's own Convex deployment — no iframe, no external host.
//
// Reads are shared (every visitor sees the canon chart); writes are
// operator-gated server-side and hidden read-only for everyone else.
// The route, <title>, meta description and nav links are unchanged from
// the embed version so the URL keeps its SEO.
// =========================================================================

// three.js-based galaxy view — code-split so the landing page stays light.
const AtlasViewport = lazy(() => import("@/components/galaxy/AtlasViewport"));

export default function StarAtlas() {
  // One-shot public bootstrap: heals pre-canon faction rows on first visit.
  useFactionCanonSync();

  usePageMeta({
    title: "Star Atlas — Star Force Base 1198",
    description:
      "Interactive 3D galaxy map of the Orion Triangle. Chart new systems, propose discoveries, and stake sector claims — open to every visitor.",
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Star Atlas"
        title="Chart the Orion Triangle."
        lead="The galaxy is only as known as the fleet makes it. Explore the shared canon atlas without signing in, then sign in only when you're ready to stake a faction claim."
        secondary={{
          label: "Claim a sector",
          href: "#sector-claims",
          variant: "primary",
        }}
      />

      <section className="uf-section max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10">
        <GlassPanel accent="cyan" className="rounded-xl overflow-hidden p-0">
          {/* Console chrome — decorative brackets */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
            <span className="absolute top-2 left-2 h-5 w-5 border-t-2 border-l-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute top-2 right-2 h-5 w-5 border-t-2 border-r-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-[rgba(0,229,255,0.55)]" />
          </div>

          <Suspense
            fallback={
              <div
                className="flex flex-col items-center justify-center gap-3 h-[78vh] min-h-[540px] bg-[rgba(5,8,22,0.85)]"
                role="status"
                aria-live="polite"
              >
                <div
                  className="h-8 w-8 rounded-full border-2 border-[color:var(--uf-border)] border-t-[color:var(--uf-cyan)] animate-spin"
                  aria-hidden
                />
                <p className="text-uf-muted text-sm font-mono">
                  Plotting the galaxy…
                </p>
              </div>
            }
          >
            <AtlasViewport className="h-[78vh] min-h-[540px]" />
          </Suspense>

          <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
            <p className="text-xs text-uf-muted mr-auto">
              Open to every visitor — the chart renders for signed-out readers.
              Fleet operators maintain the canon.
            </p>
          </div>
        </GlassPanel>
      </section>

      <SectorClaims returnTo="/map" />
    </SiteShell>
  );
}
