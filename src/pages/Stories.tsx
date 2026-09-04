import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useSearchParams } from "react-router";
import { SiteShell, PageHero, NeonButton, HoloCard, StatusPill } from "@/components/uf";
import { ScrollReveal, ScaleReveal } from "@/hooks/use-scroll-reveal";
import { TrendingTags } from "@/components/widgets/TrendingTags";
import { ContinueReading } from "@/components/widgets/ContinueReading";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { hasTier, type TierId } from "@/lib/tiers";

export default function Stories() {
  const { user: viewer } = useAuth();
  const hasEarlyAccess = hasTier(
    (viewer?.tier ?? "free") as TierId | null | undefined,
    "elite",
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [filterFaction, setFilterFaction] = useState("");
  const [filterTag, setFilterTag] = useState(searchParams.get("tag") ?? "");
  const stories = useQuery(api.content.listStories, { limit: 50 });
  usePageMeta({
    title: "Stories — Star Force Base 1198",
    description: "Read the latest sci-fi stories, series, and flash fiction from the Star Force community. Canon submissions reviewed by fleet operators.",
    jsonLd: { "@type": "CollectionPage", name: "Star Force Stories", description: "Sci-fi stories from the Star Force community." },
  });
  // Sync tag from URL params (e.g. /stories?tag=Example)
  useEffect(() => {
    const urlTag = searchParams.get("tag");
    if (urlTag) setFilterTag(urlTag);
  }, [searchParams]);

  const filtered = useMemo(() => {
    if (!stories) return undefined;
    return stories.filter((s) => {
      // Elite early-access drops stay hidden from the public archive.
      if ((s as { earlyAccess?: boolean }).earlyAccess === true && !hasEarlyAccess) {
        return false;
      }
      const sText =
        (s.title + " " + s.excerpt + " " + (s.tags ?? []).join(" ")).toLowerCase();
      if (search && !sText.includes(search.toLowerCase())) return false;
      if (filterFaction && !(s.factions ?? []).includes(filterFaction)) return false;
      if (filterTag && !(s.tags ?? []).map((t: string) => t.toLowerCase()).includes(filterTag.toLowerCase())) return false;
      return true;
    });
  }, [stories, search, filterFaction, filterTag]);

  return (
    <SiteShell>
      <PageHero
        eyebrow="The Starforce Files"
        title="Transmissions from the Fleet"
        lead="Stories contributed by members, reviewed by editors, organized in series."
        primary={{ label: "Continue Mission", href: "/community", variant: "primary" }}
        secondary={{ label: "Submit Story", href: "/submit", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <ContinueReading limit={3} />
        <div className="grid md:grid-cols-3 gap-3 mb-6">
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Search
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="search the archive…"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Filter by faction
            <input
              value={filterFaction}
              onChange={(e) => setFilterFaction(e.target.value)}
              placeholder="e.g., Terran Reach"
              className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Filter by tag
            <div className="flex gap-2">
              <input
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                placeholder="e.g., Example, recon"
                className="flex-1 border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
              />
              {filterTag && (
                <button
                  type="button"
                  onClick={() => { setFilterTag(""); setSearchParams({}, { replace: true }); }}
                  className="uf-btn uf-btn--ghost text-xs shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          </label>
        </div>
        <div className="mb-4">
          <TrendingTags limit={8} />
        </div>
        <div role="status" aria-live="polite" className="text-uf-muted text-xs mb-3">
          {filtered === undefined
            ? "Synchronizing with the fleet archive…"
            : `${filtered.length} transmissions${search ? ` matching “${search}”` : ""}.`}
        </div>
        {filtered === undefined ? (
          <>
            <div className="uf-grid uf-grid--3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="uf-skeleton" style={{ height: 200 }} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="uf-btn uf-btn--ghost mt-4"
            >
              ⟳ Signal weak — retry sync
            </button>
          </>
        ) : filtered.length === 0 ? (
          <div className="uf-empty">
            {search || filterFaction
              ? "No transmissions match these filters yet."
              : "The archive is empty — be the first to transmit."}
          </div>
        ) : (
          <div className="uf-grid uf-grid--3">
            {filtered.map((s, idx) => (
              <Link key={s._id} to={`/stories/${s.slug}`} className="block">
                <ScaleReveal staggerIndex={idx}>
                <HoloCard>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <StatusPill variant="info">
                      {s.series ?? "Standalone"}
                    </StatusPill>
                    {s.readMinutes && (
                      <StatusPill variant="default">~{s.readMinutes} min</StatusPill>
                    )}
                  </div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-uf-muted text-sm mt-2">{s.excerpt}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(s.factions ?? []).slice(0, 2).map((f) => (
                      <StatusPill key={f} variant="info">
                        {f}
                      </StatusPill>
                    ))}
                    {s.classification && (
                      <StatusPill variant="warning">{s.classification}</StatusPill>
                    )}
                  </div>
                  {(s.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(s.tags ?? []).map((t: string) => (
                        <button
                          key={t}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFilterTag(t);
                            setSearchParams({ tag: t }, { replace: true });
                          }}
                          className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border border-[color:var(--uf-border)] text-uf-muted hover:text-[var(--uf-cyan)] hover:border-[var(--uf-cyan)] transition-colors cursor-pointer"
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="uf-btn uf-btn--ghost mt-4">
                    Continue Mission
                  </span>
                </HoloCard>
              </ScaleReveal>
              </Link>
            ))}
          </div>
        )}
      </section>
    </SiteShell>
  );
}
