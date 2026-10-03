import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard, NeonButton } from "@/components/uf";
import {
  AssetGrid,
  type VisualAssetDoc,
} from "@/components/visuals/AssetGrid";
import { FullScreenViewer } from "@/components/visuals/FullScreenViewer";
import { VisualUploader } from "@/components/visuals/VisualUploader";
import { CanonBadge } from "@/components/visuals/CanonBadge";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Search, X } from "lucide-react";

// =========================================================================
// Canon Image Library (/canon-images) — the public visual canon gallery:
// grid of approved artwork (yours shows pre-approval with its badge),
// filters (species · technology · faction · artist · era · mission · kind ·
// gallery folder), search, full-screen viewer with configurable downloads,
// artist credit, plus storyboards exported to the gallery.
//
// FUTURE FEATURE — DO NOT IMPLEMENT IN THIS BUILD:
//   comment threads and artist mentions on gallery items.
// =========================================================================

const KIND_FILTERS = [
  "",
  "concept",
  "storyboard",
  "portrait",
  "environment",
  "poster",
  "patch",
  "gallery",
  "other",
];

export default function CanonImages() {
  usePageMeta({
    title: "Canon Image Library — Star Force Base 1198",
    description:
      "The public visual canon: concept art, portraits, blueprints, and mission artwork approved into the Ultra Force canon.",
  });

  const [params, setParams] = useSearchParams();
  const uploaderOpen = params.has("new");
  const toggleUploader = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set("new", "1");
    else next.delete("new");
    setParams(next, { replace: true });
  };

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    kind: params.get("kind") ?? "",
    species: "",
    technology: "",
    faction: "",
    mission: "",
    era: "",
    artist: "",
    folder: params.get("folder") ?? "",
  });
  const setFilter = (key: keyof typeof filters, v: string) =>
    setFilters((f) => ({ ...f, [key]: v }));
  const clearFilters = () => {
    setFilters({
      kind: "",
      species: "",
      technology: "",
      faction: "",
      mission: "",
      era: "",
      artist: "",
      folder: "",
    });
    setSearch("");
  };

  const assets = useQuery(api.visuals.listAssets, {
    search: search.trim() || undefined,
    kind: filters.kind || undefined,
    species: filters.species.trim() || undefined,
    technology: filters.technology.trim() || undefined,
    faction: filters.faction.trim() || undefined,
    mission: filters.mission.trim() || undefined,
    era: filters.era.trim() || undefined,
    artist: filters.artist.trim() || undefined,
    folder: filters.folder.trim() || undefined,
  });
  const storyboards = useQuery(api.visuals.listStoryboards, {});
  const published = useMemo(
    () => (storyboards ?? []).filter((s) => s.published),
    [storyboards],
  );

  const [viewer, setViewer] = useState<VisualAssetDoc | null>(null);

  const filterInput =
    "sf-input w-full rounded-md px-2.5 py-1.5 text-xs";

  return (
    <SiteShell>
      <PageHero
        eyebrow="Visual canon"
        title="Canon Image Library"
        lead="Approved concept art, portraits, environments, patches, and storyboards — every piece credited to its artist and badged with its canon status."
        primary={{
          label: uploaderOpen ? "Close uploader" : "Upload artwork",
          href: "#upload",
          variant: "primary",
        }}
        secondary={{ label: "Storyboard builder", href: "/storyboards", variant: "ghost" }}
      />

      <section
        className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12"
        id="upload"
      >
        {uploaderOpen ? (
          <div className="mb-8">
            <VisualUploader
              defaults={{
                kind: params.get("kind") ?? "concept",
                folder: params.get("folder") ?? undefined,
                mission: params.get("mission") ?? undefined,
                era: params.get("era") ?? undefined,
              }}
              onUploaded={() => toggleUploader(false)}
            />
          </div>
        ) : null}

        {/* ---- Filters + search ------------------------------------------ */}
        <HoloCard className="sf-glass mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] flex-1 min-w-[220px]">
              <Search className="h-4 w-4 text-uf-muted" aria-hidden />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search titles, credits, folders…"
                className="bg-transparent outline-none w-full text-uf-text"
                aria-label="Search the library"
              />
            </label>
            <NeonButton variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4" aria-hidden /> Clear filters
            </NeonButton>
          </div>
          <div className="grid gap-3 mt-3 sm:grid-cols-3 lg:grid-cols-4">
            <label className="text-[11px] uppercase tracking-[0.14em] sf-label flex flex-col gap-1">
              Kind
              <select
                value={filters.kind}
                onChange={(e) => setFilter("kind", e.target.value)}
                className="sf-select rounded-md px-2.5 py-1.5 text-xs w-full"
              >
                {KIND_FILTERS.map((k) => (
                  <option key={k} value={k}>
                    {k || "— all —"}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["species", "Species"],
                ["technology", "Technology"],
                ["faction", "Faction"],
                ["mission", "Mission"],
                ["era", "Era"],
                ["artist", "Artist"],
                ["folder", "Gallery folder"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="text-[11px] uppercase tracking-[0.14em] sf-label flex flex-col gap-1"
              >
                {label}
                <input
                  value={filters[key]}
                  onChange={(e) => setFilter(key, e.target.value)}
                  placeholder={`filter by ${label.toLowerCase()}`}
                  className={filterInput}
                />
              </label>
            ))}
          </div>
        </HoloCard>

        {/* ---- Gallery --------------------------------------------------- */}
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="uf-eyebrow uf-eyebrow--gold sf-pulse-soft">
              The gallery
            </span>
            <h2 className="sf-head text-2xl font-semibold mt-1">
              {assets === undefined
                ? "Loading the archive…"
                : `${assets.length} piece${assets.length === 1 ? "" : "s"} on display`}
            </h2>
          </div>
        </header>

        {assets === undefined ? (
          <div className="uf-grid uf-grid--3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 200 }} />
            ))}
          </div>
        ) : (
          <AssetGrid
            assets={assets as VisualAssetDoc[]}
            onOpen={setViewer}
            empty="No artwork matches those filters — clear them, or upload the first piece."
          />
        )}

        {/* ---- Exported storyboards -------------------------------------- */}
        {published.length > 0 ? (
          <div className="mt-10">
            <header className="mb-4">
              <span className="uf-eyebrow uf-eyebrow--gold">Storyboards</span>
              <h2 className="sf-head text-xl font-semibold mt-1">
                Sequences exported to the gallery.
              </h2>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {published.map((s) => (
                <Link
                  key={s._id}
                  to={`/storyboards?id=${s._id}`}
                  className="sf-panel-in rounded-[14px] p-[3px] transition-transform hover:-translate-y-0.5"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, rgba(255,244,200,0.45) 0%, rgba(255,255,255,0) 35%, rgba(90,60,10,0.28) 100%)",
                    backgroundSize: "100% 100%",
                  }}
                >
                  <div className="sf-glass rounded-[11px] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold">{s.title}</h3>
                      <CanonBadge status="approved" />
                    </div>
                    <p className="text-uf-muted text-xs mt-1">
                      {s.panels.length} panel{s.panels.length === 1 ? "" : "s"}
                      {s.missionLink ? ` · ${s.missionLink}` : ""}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <FullScreenViewer asset={viewer} onClose={() => setViewer(null)} />
      </section>
    </SiteShell>
  );
}
