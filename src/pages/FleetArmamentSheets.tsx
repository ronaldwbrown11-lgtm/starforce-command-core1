import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Crosshair, Shield, ArrowLeft } from "lucide-react";
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

interface ArmamentSheet {
  id: number;
  vessel_ref: string;
  title: string;
  primary_armament: string | null;
  secondary_armament: string | null;
  defensive_systems: string | null;
  ammunition_notes: string | null;
  classification: string;
  created_at: string;
}

export default function FleetArmamentSheets() {
  usePageMeta({
    title: "Armament Sheets — Star Force Fleet Database",
    description: "Weapons loadouts, defensive systems, and ammunition profiles for every vessel class in the Star Force fleet.",
  });

  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [sheets, setSheets] = useState<ArmamentSheet[]>([]);
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

        const aRes = await fetch(`${API_BASE}/fleetregistry-api.php?action=archives`, { signal: abort.signal });
        if (aRes.ok) {
          const aData = await aRes.json();
          setSheets(aData.armament_sheets ?? []);
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
            <StatusPill variant={sheets.length > 0 ? "success" : "info"}>
              {loading ? "Loading…" : `${sheets.length} sheet${sheets.length === 1 ? "" : "s"}`}
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
          ) : sheets.length === 0 ? (
            <div className="uf-empty">
              No armament sheets yet. Sheets are seeded from the Fleet Registry database.
            </div>
          ) : (
            <div className="space-y-3">
              {sheets.map((sheet) => {
                const vessel = vesselMap[sheet.vessel_ref];
                return (
                  <HoloCard key={sheet.id} accent="amber">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <StatusPill variant={classColor(sheet.classification) as any}>
                            {sheet.classification}
                          </StatusPill>
                          <h3 className="text-base font-semibold">{sheet.title}</h3>
                        </div>
                        <p className="text-sm text-uf-muted">
                          {vessel
                            ? `${vessel.designation} — ${vessel.name ?? vessel.shipClass ?? "Unknown"}`
                            : `Vessel ref: ${sheet.vessel_ref}`}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {sheet.primary_armament && (
                        <div>
                          <p className="text-xs uppercase tracking-widest text-uf-amber mb-1">Primary</p>
                          <p className="text-sm text-uf-muted whitespace-pre-wrap">{sheet.primary_armament}</p>
                        </div>
                      )}
                      {sheet.secondary_armament && (
                        <div>
                          <p className="text-xs uppercase tracking-widest text-uf-amber mb-1">Secondary</p>
                          <p className="text-sm text-uf-muted whitespace-pre-wrap">{sheet.secondary_armament}</p>
                        </div>
                      )}
                      {sheet.defensive_systems && (
                        <div>
                          <p className="text-xs uppercase tracking-widest text-uf-cyan mb-1">Defensive</p>
                          <p className="text-sm text-uf-muted whitespace-pre-wrap">{sheet.defensive_systems}</p>
                        </div>
                      )}
                      {sheet.ammunition_notes && (
                        <div>
                          <p className="text-xs uppercase tracking-widest text-uf-violet mb-1">Ammunition</p>
                          <p className="text-sm text-uf-muted whitespace-pre-wrap">{sheet.ammunition_notes}</p>
                        </div>
                      )}
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
