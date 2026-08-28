import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Ship, ArrowLeft } from "lucide-react";
import { SiteShell, PageHero, GlassPanel, HoloCard, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

const API_BASE = "https://fleetregistry.starforcebase1198.com";

interface Vessel {
  _id: string;
  designation: string;
  name?: string;
  shipClass?: string;
  registryNumber?: string;
  status?: string;
}

interface ServiceRecord {
  id: number;
  vessel_ref: string;
  event_date: string | null;
  event_type: string;
  title: string;
  details: string | null;
  location: string | null;
  source_reference: string | null;
  created_at: string;
}

export default function FleetServiceHistory() {
  usePageMeta({
    title: "Service Histories — Star Force Fleet Database",
    description: "Operational service records, deployments, refits, and milestones for every vessel in the Star Force fleet.",
  });

  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const vRes = await fetch(`${API_BASE}/api/vessels`, { signal: abort.signal });
        if (!vRes.ok) throw new Error("Failed to load vessels");
        const vData: Vessel[] = await vRes.json();
        setVessels(vData);

        const sRes = await fetch(`${API_BASE}/fleetregistry-api.php?action=archives`, { signal: abort.signal });
        if (sRes.ok) {
          const sData = await sRes.json();
          setRecords(sData.service_histories ?? []);
        }
      } catch (e: any) {
        if (e.name !== "AbortError") setError(e.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => abort.abort();
  }, []);

  const vesselMap = Object.fromEntries(vessels.map((v) => [v._id, v]));

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
            <StatusPill variant={records.length > 0 ? "success" : "info"}>
              {loading ? "Loading…" : `${records.length} record${records.length === 1 ? "" : "s"}`}
            </StatusPill>
          </div>

          {error && (
            <div className="uf-card border-uf-red/30 bg-uf-red/5 text-uf-red text-sm p-4 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="uf-skeleton h-24" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="uf-empty">
              No service records yet. Records are seeded from the Fleet Registry database.
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((rec) => {
                const vessel = vesselMap[rec.vessel_ref];
                return (
                  <HoloCard key={rec.id} accent="violet">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <StatusPill variant="violet">{rec.event_type}</StatusPill>
                          {rec.event_date && (
                            <span className="text-xs text-uf-muted font-mono">{rec.event_date}</span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold">{rec.title}</h3>
                        <p className="text-sm text-uf-muted mt-1">
                          {vessel
                            ? `${vessel.designation} — ${vessel.name ?? vessel.shipClass ?? "Unknown"}`
                            : `Vessel ref: ${rec.vessel_ref}`}
                        </p>
                        {rec.details && (
                          <p className="text-sm text-uf-muted mt-2 whitespace-pre-wrap">{rec.details}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {rec.location && (
                          <p className="text-xs text-uf-muted">{rec.location}</p>
                        )}
                        {rec.source_reference && (
                          <p className="text-xs text-uf-muted font-mono mt-1">{rec.source_reference}</p>
                        )}
                      </div>
                    </div>
                  </HoloCard>
                );
              })}
            </div>
          )}
        </GlassPanel>
      </section>
    </SiteShell>
  );
}
