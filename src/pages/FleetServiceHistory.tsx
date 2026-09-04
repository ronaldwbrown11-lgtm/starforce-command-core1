import { Link } from "react-router";
import { Ship } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, GlassPanel, HoloCard, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function FleetServiceHistory() {
  usePageMeta({
    title: "Service Histories — Star Force Fleet Database",
    description: "Operational service records, deployments, refits, and milestones for every vessel in the Star Force fleet.",
  });

  const records = useQuery(api.fleetRecords.listServiceHistories);
  const loading = records === undefined;
  const data = records ?? [];

  return (
    <SiteShell>
      <PageHero
        eyebrow="Fleet Command"
        title="SERVICE HISTORIES"
        lead="Every deployment, refit, and milestone in the fleet — linked to the vessel that lived it."
        primary={{ label: "Back to Fleet Database", href: "/fleet-registry", variant: "primary" }}
        secondary={{ label: "Armament sheets", href: "/fleet-registry/armament-sheets", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-12">
        <GlassPanel accent="violet">
          <div className="flex items-center gap-3 mb-6">
            <Ship className="h-5 w-5 text-uf-cyan" />
            <h2 className="text-xl font-semibold">Service Records</h2>
            <StatusPill variant={data.length > 0 ? "success" : "info"}>
              {loading ? "Loading…" : `${data.length} record${data.length === 1 ? "" : "s"}`}
            </StatusPill>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="uf-skeleton h-24" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="uf-empty">
              No service records on record. Operators can log records from the Operator Console.
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((rec) => (
                <HoloCard key={rec._id} accent="violet">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <StatusPill variant="violet">{rec.eventType}</StatusPill>
                        {rec.eventDate && (
                          <span className="text-xs text-uf-muted font-mono">{rec.eventDate}</span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold">{rec.title}</h3>
                      <p className="text-sm text-uf-muted mt-1">
                        {rec.vessel
                          ? `${rec.vessel.designation} — ${rec.vessel.name}`
                          : "Unlinked vessel"}
                      </p>
                      {rec.details && (
                        <p className="text-sm text-uf-muted mt-2 whitespace-pre-wrap">{rec.details}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {rec.location && (
                        <p className="text-xs text-uf-muted">{rec.location}</p>
                      )}
                      {rec.sourceReference && (
                        <p className="text-xs text-uf-muted font-mono mt-1">{rec.sourceReference}</p>
                      )}
                    </div>
                  </div>
                </HoloCard>
              ))}
            </div>
          )}
        </GlassPanel>
      </section>
    </SiteShell>
  );
}
