import { SiteShell, PageHero, HoloCard } from "@/components/uf";
import { DiscoveryMap } from "@/components/widgets/DiscoveryMap";
import { useAuth } from "@/hooks/use-auth";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Link } from "react-router";
import { Compass, Crosshair, Route } from "lucide-react";

export default function StarAtlas() {
  const { isAuthenticated } = useAuth();
  usePageMeta({
    title: "Star Atlas — Star Force Base 1198",
    description: "Interactive galaxy map of the Outer Rim. Chart new systems, propose discoveries, and build the fleet's knowledge of the frontier.",
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Star Atlas"
        title="Chart the Outer Rim."
        lead="The galaxy is only as known as the fleet makes it. Survey an empty region, propose a system, and put your name on a star the Bridge canonizes for everyone."
        primary={
          isAuthenticated
            ? { label: "Chart a system", href: "/map", variant: "primary" }
            : { label: "Sign in to chart", href: "/auth?returnTo=/map", variant: "primary" }
        }
        secondary={{ label: "Survey operations", href: "/missions", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-12">
        <DiscoveryMap height={540} />

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <HoloCard>
            <Crosshair className="h-5 w-5 text-uf-cyan" aria-hidden />
            <h3 className="text-base mt-2">Click to survey</h3>
            <p className="text-uf-muted text-sm mt-1">
              Any empty region of the chart can become a system. Click it, name it, and file your survey.
            </p>
          </HoloCard>
          <HoloCard>
            <Compass className="h-5 w-5 text-uf-violet" aria-hidden />
            <h3 className="text-base mt-2">The Bridge decides</h3>
            <p className="text-uf-muted text-sm mt-1">
              Operators review every proposal against canon. Approvals are charted publicly and earn +25 XP.
            </p>
          </HoloCard>
          <HoloCard>
            <Route className="h-5 w-5 text-uf-gold" aria-hidden />
            <h3 className="text-base mt-2">Tie it to an operation</h3>
            <p className="text-uf-muted text-sm mt-1">
              Attach your survey to an open mapping mission — the discovery counts toward the operation.
            </p>
            <Link to="/missions" className="text-uf-cyan text-sm mt-2 inline-block">
              Open the mission board →
            </Link>
          </HoloCard>
        </div>
      </section>
    </SiteShell>
  );
}
