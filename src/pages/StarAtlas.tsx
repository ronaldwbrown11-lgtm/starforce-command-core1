import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { SiteShell, PageHero, GlassPanel, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

// The Star Atlas is a dedicated application served from its own host
// (staratlas.freebuff.app). It supersedes the in-house 3D/2D atlas that used
// to live on this route — that chart never held up, so the main site now
// embeds the standalone app instead of re-implementing cartography.
const STAR_ATLAS_URL = "https://staratlas.freebuff.app/dashboard";

export default function StarAtlas() {
  const [loaded, setLoaded] = useState(false);

  usePageMeta({
    title: "Star Atlas — Star Force Base 1198",
    description:
      "The Star Atlas — an interactive galaxy map of the Orion Triangle. Survey systems, trace lanes, and chart the frontier in the dedicated atlas application.",
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Star Atlas"
        title="Chart the Orion Triangle."
        lead="The galaxy is only as known as the fleet makes it. Survey an empty region, propose a system, and put your name on a star the Bridge canonizes for everyone."
        secondary={{
          label: "Open in a new tab",
          href: STAR_ATLAS_URL,
          variant: "ghost",
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

          <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
            <span className="uf-eyebrow mr-auto">Star atlas // live cartography</span>
            <StatusPill variant={loaded ? "success" : "info"}>
              {loaded ? "Link established" : "Establishing link…"}
            </StatusPill>
            <span className="hidden md:inline font-mono text-[11px] text-uf-muted">
              src: staratlas.freebuff.app
            </span>
          </div>

          <div className="relative">
            {!loaded && (
              <div
                className="flex flex-col items-center justify-center gap-3 min-h-[78vh] bg-[rgba(5,8,22,0.85)]"
                role="status"
                aria-live="polite"
              >
                <div
                  className="h-8 w-8 rounded-full border-2 border-[color:var(--uf-border)] border-t-[color:var(--uf-cyan)] animate-spin"
                  aria-hidden
                />
                <p className="text-uf-muted text-sm font-mono">
                  Contacting the star atlas…
                </p>
              </div>
            )}
            <iframe
              title="Star Atlas — interactive galaxy map"
              src={STAR_ATLAS_URL}
              onLoad={() => setLoaded(true)}
              className="block w-full border-0 min-h-[78vh] bg-[#050816]"
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>

          <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
            <p className="text-xs text-uf-muted mr-auto">
              The atlas runs as a standalone application. Charted systems and
              proposals are maintained there.
            </p>
            <a
              href={STAR_ATLAS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-uf-cyan hover:text-uf-text focus-visible:outline-2 focus-visible:outline-[color:var(--uf-cyan)] rounded"
            >
              Open the atlas <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </GlassPanel>
      </section>
    </SiteShell>
  );
}
