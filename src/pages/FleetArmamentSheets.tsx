import { Link } from "react-router";
import { Crosshair, ArrowLeft } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, GlassPanel, HoloCard, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function FleetArmamentSheets() {
  usePageMeta({
    title: "Armament Sheets — Star Force Fleet Database",
    description: "Weapons loadouts, defensive systems, and ammunition profiles for every vessel class in the Star Force fleet.",
  });

  const sheets = useQuery(api.fleetRecords.listArmamentSheets);

  const loading = sheets === undefined;
  const data = sheets ?? [];

  const classColor = (cls: string) => {
    if (cls === "heavy") return "warning";
    if (cls === "classified") return "danger";
    return "info";
  };

  return (
    <SiteShell>
      <PageHero
        eyebrow="Fleet Command"
        title="ARMAMENT SHEETS"
        lead="Primary, secondary, and defensive weapons profiles — cross-referenced against each registered hull."
        primary={{ label: "Back to Fleet Database", href: "/fleet-registry", variant: "primary" }}
        secondary={{ label: "Black-box files", href: "/fleet-registry/black-box-files", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-12">
        <GlassPanel accent="amber">
          <div className="flex items-center gap-3 mb-6">
            <Crosshair className="h-5 w-5 text-uf-amber" />
            <h2 className="text-xl font-semibold">Armament Loadouts</h2>
            <StatusPill variant={data.length > 0 ? "success" : "info"}>
              {loading ? "Loading…" : `${data.length} sheet${data.length === 1 ? "" : "s"}`}
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
              No armament sheets on record. Operators can add sheets from the Operator Console.
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((sheet) => (
                <HoloCard key={sheet._id} accent="amber">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <StatusPill variant={classColor(sheet.classification) as any}>
                          {sheet.classification}
                        </StatusPill>
                        <h3 className="text-base font-semibold">{sheet.title}</h3>
                      </div>
                      <p className="text-sm text-uf-muted">
                        {sheet.vessel
                          ? `${sheet.vessel.designation} — ${sheet.vessel.name}`
                          : "Unlinked vessel"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {sheet.primaryArmament && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-uf-amber mb-1">Primary</p>
                        <p className="text-sm text-uf-muted whitespace-pre-wrap">{sheet.primaryArmament}</p>
                      </div>
                    )}
                    {sheet.secondaryArmament && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-uf-amber mb-1">Secondary</p>
                        <p className="text-sm text-uf-muted whitespace-pre-wrap">{sheet.secondaryArmament}</p>
                      </div>
                    )}
                    {sheet.defensiveSystems && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-uf-cyan mb-1">Defensive</p>
                        <p className="text-sm text-uf-muted whitespace-pre-wrap">{sheet.defensiveSystems}</p>
                      </div>
                    )}
                    {sheet.ammunitionNotes && (
                      <div>
                        <p className="text-xs uppercase tracking-widest text-uf-violet mb-1">Ammunition</p>
                        <p className="text-sm text-uf-muted whitespace-pre-wrap">{sheet.ammunitionNotes}</p>
                      </div>
                    )}
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
