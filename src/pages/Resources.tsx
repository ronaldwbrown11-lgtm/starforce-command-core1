import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";

import { usePageMeta } from "@/hooks/use-page-meta";
export default function Resources() {
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const items = useQuery(api.content.listResources, { type: type || undefined, limit: 60 });
  const filtered = (items ?? []).filter((r) =>
    !search ||
    (r.title + " " + r.description).toLowerCase().includes(search.toLowerCase()),
  );

  const formatBytes = (b?: number | null) => {
    if (!b) return "";
    if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${b} B`;
  };
  usePageMeta({ title: "Resources — Star Force Base 1198", description: "Guides, tools, policies, and onboarding materials for Star Force personnel.", noindex: false });


  return (
    <SiteShell>
      <PageHero
        eyebrow="Resources"
        title="Guides, tools, and policies."
        lead="Searchable archive of community-maintained resources for every tier."
        primary={{ label: "Open Community Charter", href: "/community", variant: "primary" }}
        secondary={{ label: "Submit Story", href: "/submit", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid md:grid-cols-2 gap-3 mb-6">
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search resources…"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Type
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            >
              <option value="">Any</option>
              <option value="guide">Guide</option>
              <option value="tool">Tool</option>
              <option value="download">Download</option>
              <option value="onboarding">Onboarding</option>
              <option value="policy">Policy</option>
            </select>
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="uf-empty">No resources match this filter.</div>
        ) : (
          <div className="uf-grid uf-grid--3">
            {filtered.map((r) => (
              <HoloCard key={r._id}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <StatusPill variant="info">{r.resourceType ?? "guide"}</StatusPill>
                  {r.tierRequired && <StatusPill variant="warning">Tier: {r.tierRequired}</StatusPill>}
                </div>
                <h3 className="text-lg font-semibold">{r.title}</h3>
                <p className="text-uf-muted text-sm mt-2">{r.description}</p>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="uf-btn uf-btn--ghost mt-3">Open resource</a>
                ) : (
                  <p className="text-xs text-uf-muted/50 mt-3 font-mono uppercase tracking-wider">Awaiting transmission</p>
                )}
              </HoloCard>
            ))}
            {items === undefined && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="uf-skeleton" style={{ height: 180 }} />)}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
