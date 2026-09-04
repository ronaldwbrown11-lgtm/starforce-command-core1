import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { SiteShell, PageHero, GlassPanel, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

// The fleet registry lives in the dedicated subdomain application
// (Star Force Fleet Database — vessel records, specifications, armament,
// and operational history maintained by Fleet Command). The main site
// embeds it here rather than duplicating the database.
const FLEET_REGISTRY_URL = "https://fleetregistry.starforcebase1198.com/registry";

export default function FleetRegistry() {
  const [loaded, setLoaded] = useState(false);

  usePageMeta({
    title: "Star Force Fleet Database — Star Force Base 1198",
    description:
      "The official Star Force fleet registry — vessel records, specifications, armament, and operational history, maintained by Fleet Command.",
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Star Force Command"
        title="FLEET DATABASE"
        lead="Every hull that flies under the Star Force banner is logged in the registry — registry numbers, class specifications, armament, and service history, maintained by Fleet Command in the vehicle archive."
        secondary={{
          label: "Open in a new tab",
          href: FLEET_REGISTRY_URL,
          variant: "ghost",
        }}
      />

      <section className="uf-section max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12">
        <GlassPanel accent="cyan" className="rounded-xl overflow-hidden p-0">
          {/* Console chrome — decorative brackets */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
            <span className="absolute top-2 left-2 h-5 w-5 border-t-2 border-l-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute top-2 right-2 h-5 w-5 border-t-2 border-r-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-[rgba(0,229,255,0.55)]" />
          </div>

          <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
            <span className="uf-eyebrow mr-auto">Fleet registry // vessel database</span>
            <StatusPill variant={loaded ? "success" : "info"}>
              {loaded ? "Link established" : "Establishing link…"}
            </StatusPill>
            <span className="hidden md:inline font-mono text-[11px] text-uf-muted">
              src: fleetregistry.starforcebase1198.com
            </span>
          </div>

          <div className="relative">
            {!loaded && (
              <div
                className="flex flex-col items-center justify-center gap-3 min-h-[70vh] bg-[rgba(5,8,22,0.85)]"
                role="status"
                aria-live="polite"
              >
                <div className="h-8 w-8 rounded-full border-2 border-[color:var(--uf-border)] border-t-[color:var(--uf-cyan)] animate-spin" aria-hidden />
                <p className="text-uf-muted text-sm font-mono">
                  Contacting the fleet registry…
                </p>
              </div>
            )}
            <iframe
              title="Star Force Fleet Registry — vessel database"
              src={FLEET_REGISTRY_URL}
              onLoad={() => setLoaded(true)}
              className="block w-full border-0 min-h-[78vh] bg-[#050816]"
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>

          <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
            <p className="text-xs text-uf-muted mr-auto">
              Records are maintained by Fleet Command in the vehicle archive.
            </p>
            <a
              href={FLEET_REGISTRY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-uf-cyan hover:text-uf-text focus-visible:outline-2 focus-visible:outline-[color:var(--uf-cyan)] rounded"
            >
              Open full registry <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>
        </GlassPanel>
      </section>
    </SiteShell>
  );
}
