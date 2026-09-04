import { Link } from "react-router";
import { ShieldAlert, Lock } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, GlassPanel, HoloCard, StatusPill } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function FleetBlackBoxFiles() {
  usePageMeta({
    title: "Black-box Files — Star Force Fleet Database",
    description: "Classified incident reports and black-box recordings accessible to Star Force operators only.",
  });

  const { isAuthenticated, user } = useAuth();
  const isOperator = !!user?.opRole;

  const files = useQuery(
    api.fleetRecords.listBlackBoxFiles,
    isOperator ? {} : "skip",
  );

  const loading = isOperator && files === undefined;
  const data = files ?? [];

  if (!isAuthenticated || !isOperator) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Fleet Command — Restricted"
          title="BLACK-BOX FILES"
          lead="Operator clearance required. This section contains classified incident reports and black-box recordings."
          primary={{ label: "Back to Fleet Database", href: "/fleet-registry", variant: "primary" }}
        />
        <section className="uf-section max-w-[800px] mx-auto px-4 sm:px-6 lg:px-12">
          <GlassPanel accent="magenta">
            <div className="flex flex-col items-center text-center py-12">
              <Lock className="h-12 w-12 text-uf-red mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
              <p className="text-uf-muted text-sm max-w-md">
                Black-box files are classified and accessible only to authenticated Star Force operators.
                {!isAuthenticated && " Sign in with an operator account to view these records."}
              </p>
              {!isAuthenticated && (
                <Link to="/auth?returnTo=/fleet-registry/black-box-files" className="mt-4">
                  <StatusPill variant="info">Sign in as operator</StatusPill>
                </Link>
              )}
            </div>
          </GlassPanel>
        </section>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow="Fleet Command — Restricted"
        title="BLACK-BOX FILES"
        lead="Classified incident reports, black-box recordings, and investigation summaries for operator eyes only."
        primary={{ label: "Back to Fleet Database", href: "/fleet-registry", variant: "primary" }}
        secondary={{ label: "Service histories", href: "/fleet-registry/service-histories", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-12">
        <GlassPanel accent="magenta">
          <div className="flex items-center gap-3 mb-6">
            <ShieldAlert className="h-5 w-5 text-uf-magenta" />
            <h2 className="text-xl font-semibold">Classified Files</h2>
            <StatusPill variant={data.length > 0 ? "success" : "info"}>
              {loading ? "Loading…" : `${data.length} file${data.length === 1 ? "" : "s"}`}
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
              No black-box files on record. Operators can upload classified files from the Operator Console.
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((file) => (
                <HoloCard key={file._id} accent="magenta">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <StatusPill variant="danger">{file.classification}</StatusPill>
                        <span className="text-xs text-uf-muted font-mono">{file.fileCode}</span>
                        {file.incidentDate && (
                          <span className="text-xs text-uf-muted font-mono">{file.incidentDate}</span>
                        )}
                      </div>
                      <h3 className="text-base font-semibold">{file.title}</h3>
                      <p className="text-sm text-uf-muted">
                        {file.vessel
                          ? `${file.vessel.designation} — ${file.vessel.name}`
                          : "Unlinked vessel"}
                      </p>
                    </div>
                  </div>

                  {file.summary && (
                    <p className="text-sm text-uf-muted whitespace-pre-wrap border-t border-[color:var(--uf-border)] pt-3 mt-3">
                      {file.summary}
                    </p>
                  )}

                  {file.payload && (
                    <div className="mt-3 border-t border-[color:var(--uf-border)] pt-3">
                      <p className="text-xs uppercase tracking-widest text-uf-magenta mb-1">Full Record</p>
                      <pre className="text-xs text-uf-muted whitespace-pre-wrap bg-[rgba(5,8,22,0.4)] rounded-md p-3 overflow-x-auto">
                        {file.payload}
                      </pre>
                    </div>
                  )}
                </HoloCard>
              ))}
            </div>
          )}
        </GlassPanel>
      </section>
    </SiteShell>
  );
}
