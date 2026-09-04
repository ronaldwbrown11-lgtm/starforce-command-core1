import { Link } from "react-router";
import { Compass, Crosshair, Library, Ship, Search, Filter } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  SiteShell,
  PageHero,
  GlassPanel,
  HoloCard,
  StatCard,
  StatusPill,
} from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function FleetRegistry() {
  usePageMeta({
    title: "Star Force Fleet Database — Star Force Base 1198",
    description:
      "Explore the official Star Force fleet registry with vessel records, specifications, operational history, and classified lore files.",
  });

  const stats = useQuery(api.fleetRecords.fleetStats);
  const vessels = useQuery(api.vessels.listAll);

  const ARCHIVE_STRIPS = [
    {
      label: "Hulls & classes",
      value: stats ? `${stats.vesselCount} vessels` : "Loading…",
      accent: "cyan" as const,
      href: "#fleet-console",
    },
    {
      label: "Service histories",
      value: stats ? `${stats.historyCount} records` : "Loading…",
      accent: "violet" as const,
      href: "/fleet-registry/service-histories",
    },
    {
      label: "Armament sheets",
      value: stats ? `${stats.sheetCount} sheets` : "Loading…",
      accent: "amber" as const,
      href: "/fleet-registry/armament-sheets",
    },
    {
      label: "Black-box files",
      value: stats ? `${stats.blackBoxCount} files` : "Loading…",
      accent: "magenta" as const,
      href: "/fleet-registry/black-box-files",
    },
  ];

  const RELATED = [
    {
      to: "/map",
      icon: Compass,
      accent: "cyan" as const,
      title: "Star Atlas",
      body: "Cross-reference hull assignments against the charted sectors of the Outer Rim and see where the fleet is deployed.",
    },
    {
      to: "/lore",
      icon: Library,
      accent: "violet" as const,
      title: "Canon databases",
      body: "The Armory and personnel archives live beside the fleet registry in the Lore Library — one canon, four archives.",
    },
    {
      to: "/missions",
      icon: Crosshair,
      accent: "amber" as const,
      title: "Mission board",
      body: "Operations log new hulls into the registry as they launch. Follow the board to watch records earn their first patrol.",
    },
  ];

  return (
    <SiteShell>
      <PageHero
        eyebrow="Star Force Command"
        title="FLEET DATABASE"
        lead="Every hull that flies under the Star Force banner is logged here — registry numbers, class specifications, armament, and service history, maintained by Fleet Command in the vehicle archive."
        primary={{
          label: "Open the Star Atlas",
          href: "/map",
          variant: "primary",
        }}
        secondary={{
          label: "Canon databases",
          href: "/lore",
          variant: "ghost",
        }}
      />

      {/* ---- Archive stats strip ---- */}
      <section className="uf-section max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {ARCHIVE_STRIPS.map((strip) => (
            <Link
              key={strip.label}
              to={strip.href}
              className="block focus-visible:outline-2 focus-visible:outline-[color:var(--uf-cyan)] rounded-xl"
            >
              <StatCard
                label={strip.label}
                value={strip.value}
                accent={strip.accent}
              />
            </Link>
          ))}
        </div>

        {/* ---- Live vessel browser ---- */}
        <GlassPanel accent="cyan" id="fleet-console" className="rounded-xl overflow-hidden p-0">
          {/* Console chrome — decorative brackets */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
            <span className="absolute top-2 left-2 h-5 w-5 border-t-2 border-l-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute top-2 right-2 h-5 w-5 border-t-2 border-r-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-[rgba(0,229,255,0.55)]" />
          </div>

          <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
            <span className="uf-eyebrow mr-auto">Fleet registry // vessel database</span>
            <StatusPill variant={vessels && vessels.length > 0 ? "success" : "info"}>
              {vessels === undefined
                ? "Loading…"
                : `${vessels.length} hull${vessels.length === 1 ? "" : "s"} catalogued`}
            </StatusPill>
            <span className="hidden md:inline font-mono text-[11px] text-uf-muted">
              src: Convex fleet database
            </span>
          </div>

          <div className="relative p-4 sm:p-6">
            {vessels === undefined ? (
              <div className="space-y-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="uf-skeleton h-20" />
                ))}
              </div>
            ) : vessels.length === 0 ? (
              <div className="uf-empty py-12">
                <Ship className="h-10 w-10 text-uf-cyan mx-auto mb-3 opacity-40" />
                <p className="text-uf-muted">No vessels in the registry yet.</p>
                <p className="text-uf-muted text-xs mt-1">
                  Operators can seed vessels from the Operator Console → Fleet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {vessels.map((v) => (
                  <article
                    key={v._id}
                    className="flex flex-wrap items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border border-[color:var(--uf-border-subtle)] bg-[rgba(16,24,39,0.45)] hover:border-[color:var(--uf-border)] transition-colors"
                  >
                    {/* Badge pill */}
                    <StatusPill
                      variant={
                        v.badge === "FLAGSHIP"
                          ? "gold"
                          : v.badge === "CLASSIFIED"
                            ? "danger"
                            : v.badge === "CARRIER"
                              ? "cyan"
                              : v.badge === "INTERCEPTOR"
                                ? "warning"
                                : "info"
                      }
                    >
                      {v.badge}
                    </StatusPill>

                    {/* Core identity */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold truncate">
                          {v.name}
                        </h3>
                        {v.classified && (
                          <span className="text-[10px] uppercase tracking-widest text-uf-red font-mono">
                            CLASSIFIED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-uf-muted mt-0.5 truncate">
                        {v.designation}
                        {v.registry ? ` · ${v.registry}` : ""}
                        {v.shipClass ? ` · ${v.shipClass}` : ""}
                      </p>
                    </div>

                    {/* Role */}
                    <p className="text-xs text-uf-muted max-w-xs hidden lg:block truncate">
                      {v.role}
                    </p>

                    {/* Status */}
                    <StatusPill
                      variant={
                        v.status === "active"
                          ? "success"
                          : v.status === "reserve"
                            ? "warning"
                            : "danger"
                      }
                    >
                      {v.status ?? "active"}
                    </StatusPill>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
            <Ship className="h-4 w-4 text-uf-cyan shrink-0" aria-hidden />
            <p className="text-xs text-uf-muted">
              Records are maintained by Fleet Command. Submissions and
              corrections route through the Bridge.
            </p>
          </div>
        </GlassPanel>
      </section>

      {/* ---- Related archives ---- */}
      <section className="uf-section max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 pb-4">
        <span className="uf-eyebrow">Related archives</span>
        <h2 className="text-xl mt-1 mb-4">One fleet, four archives</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {RELATED.map((item) => (
            <HoloCard
              key={item.to}
              as="article"
              accent={item.accent}
              className="h-full"
            >
              <Link
                to={item.to}
                className="group flex flex-col h-full focus-visible:outline-2 focus-visible:outline-[color:var(--uf-cyan)] rounded-md"
              >
                <item.icon
                  className="h-5 w-5 text-uf-cyan transition-transform duration-200 group-hover:-translate-y-0.5"
                  aria-hidden
                />
                <h3 className="text-base mt-2">{item.title}</h3>
                <p className="text-uf-muted text-sm mt-1 flex-1">{item.body}</p>
                <span className="uf-eyebrow mt-3 text-[10px]">
                  Open archive →
                </span>
              </Link>
            </HoloCard>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
