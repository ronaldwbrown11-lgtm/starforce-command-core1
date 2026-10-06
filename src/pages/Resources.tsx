import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { DocViewer } from "@/components/widgets/DocViewer";
import { Kbd } from "@/components/ui/kbd";

import { usePageMeta } from "@/hooks/use-page-meta";

// ---------------------------------------------------------------------------
// Quick start — the five-step orientation shown above the archive.
// ---------------------------------------------------------------------------
const QUICK_START: { title: string; body: string; href: string; linkLabel: string }[] = [
  {
    title: "Claim your service profile",
    body: "Sign in, then set your call-sign, tier and home sector from the Account hub.",
    href: "/account",
    linkLabel: "Open Account",
  },
  {
    title: "Take the first-watch tour",
    body: "Six guided objectives that walk the whole site and pay starter rewards.",
    href: "/first-watch",
    linkLabel: "Start First Watch",
  },
  {
    title: "Explore the Star Atlas",
    body: "Fly the shared 3D galaxy, read the lore on any star, and claim a sector for your faction.",
    href: "/map",
    linkLabel: "Open the Star Atlas",
  },
  {
    title: "Create something canonical",
    body: "Draft a story, file a lore entry, or chart a discovery from the Creator Hub.",
    href: "/creator",
    linkLabel: "Enter the Creator Hub",
  },
  {
    title: "Pull a reference record",
    body: "Personnel, Fleet, Armory, Species and Technology databases are all searchable — start with the archive below.",
    href: "/lore",
    linkLabel: "Browse the Lore Library",
  },
];

// Keyboard controls for the 3D Star Atlas at /map.
const ATLAS_KEYS: { keys: string[]; action: string }[] = [
  { keys: ["Up", "Down"], action: "Slide the map view up / down" },
  { keys: ["Left", "Right"], action: "Slide the map view left / right" },
  { keys: ["W", "A", "S", "D"], action: "Slide the map (same as the arrow keys)" },
  { keys: ["+", "\u2212"], action: "Zoom in / out" },
  { keys: ["Shift", "Arrows"], action: "Hop the highlight between nearby stars" },
  { keys: ["Enter"], action: "Open the highlighted star" },
  { keys: ["Esc"], action: "Cancel placing / close a dialog" },
];

// Mouse & touch controls for the 3D Star Atlas at /map.
const ATLAS_MOUSE: { input: string; action: string }[] = [
  { input: "Left-drag", action: "Orbit / spin the galaxy" },
  { input: "Middle-drag", action: "Slide the map up, down, left or right" },
  { input: "Shift + scroll", action: "Slide the map up / down" },
  { input: "Scroll / pinch", action: "Zoom in / out, anchored at the cursor" },
  { input: "Right-drag up/down", action: "Zoom in / out" },
  { input: "Click a label", action: "Fly to that quadrant, sector or star" },
];

export default function Resources() {
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [reader, setReader] = useState<{ url: string; name: string } | null>(null);
  const [searchParams] = useSearchParams();
  const items = useQuery(api.content.listResources, { type: type || undefined, limit: 60 });

  // Deep link: /resources?open=<resourceId> opens that document in the
  // on-page reader (used by the Creator Hub resource cards so files open in
  // the reader instead of the raw Convex storage URL).
  const openParam = searchParams.get("open");
  useEffect(() => {
    if (!openParam || !items) return;
    const target = items.find((r) => r._id === openParam);
    if (target?.fileUrl) {
      setReader({
        url: target.fileUrl,
        name: target.fileMeta?.fileName ?? target.title,
      });
    }
  }, [openParam, items]);
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

  // Cards are clickable: uploaded files open ON THE PAGE (inline reader),
  // external resources open in a new tab.
  const openResource = (r: {
    title: string;
    fileUrl?: string | null;
    url?: string | null;
    fileMeta?: { fileName?: string } | null;
  }) => {
    if (r.fileUrl) {
      setReader({ url: r.fileUrl, name: r.fileMeta?.fileName ?? r.title });
    } else if (r.url) {
      window.open(r.url, "_blank", "noopener,noreferrer");
    }
  };


  return (
    <SiteShell>
      <PageHero
        eyebrow="Resources"
        title="Guides, tools, and policies."
        lead="Searchable archive of community-maintained resources for every tier."
        primary={{ label: "Open Community Charter", href: "/community", variant: "primary" }}
        secondary={{ label: "Submit Story", href: "/submit", variant: "ghost" }}
      />

      {/* Quick user guide + keyboard/mouse legend */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr] mb-8">
          <HoloCard accent="cyan">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusPill variant="info">Quick start</StatusPill>
              <StatusPill variant="gold">First visit</StatusPill>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Your first fifteen minutes</h2>
            <p className="text-uf-muted text-sm mt-2">
              A five-step tour of the base. Every stop opens on this site.
            </p>
            <ol className="mt-4 flex flex-col gap-3 list-none p-0 m-0">
              {QUICK_START.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--uf-border)] font-mono text-xs text-uf-cyan"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{step.title}</p>
                    <p className="text-uf-muted text-xs mt-0.5">{step.body}</p>
                    <Link to={step.href} className="text-xs text-uf-cyan underline mt-1 inline-block">
                      {step.linkLabel}
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          </HoloCard>

          <HoloCard accent="amber">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <StatusPill variant="info">Controls</StatusPill>
              <StatusPill variant="gold">Star Atlas</StatusPill>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">Keyboard &amp; mouse</h2>
            <p className="text-uf-muted text-sm mt-2">
              These drive the 3D Star Atlas at <span className="font-mono">/map</span>.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div>
                <p className="uf-eyebrow mb-2">Keyboard</p>
                <ul className="flex flex-col gap-2 list-none p-0 m-0">
                  {ATLAS_KEYS.map((row) => (
                    <li key={row.action} className="flex items-start gap-2">
                      <span className="flex shrink-0 flex-wrap items-center gap-1">
                        {row.keys.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </span>
                      <span className="text-uf-muted text-xs leading-5">{row.action}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="uf-eyebrow mb-2">Mouse &amp; touch</p>
                <ul className="flex flex-col gap-2 list-none p-0 m-0">
                  {ATLAS_MOUSE.map((row) => (
                    <li key={row.input} className="flex items-start gap-2">
                      <span className="shrink-0 rounded border border-[color:var(--uf-border)] px-1.5 py-0.5 font-mono text-[10px] text-uf-text">
                        {row.input}
                      </span>
                      <span className="text-uf-muted text-xs leading-5">{row.action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </HoloCard>
        </div>
      </section>

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
              <HoloCard
                key={r._id}
                className={r.fileUrl || r.url ? "cursor-pointer" : ""}
                htmlProps={{
                  role: "button",
                  tabIndex: 0,
                  "aria-label": `Open ${r.title}`,
                  onClick: () => openResource(r),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openResource(r);
                    }
                  },
                }}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <StatusPill variant="info">{r.resourceType ?? "guide"}</StatusPill>
                  {r.tierRequired && <StatusPill variant="warning">Tier: {r.tierRequired}</StatusPill>}
                </div>
                <h3 className="text-lg font-semibold">{r.title}</h3>
                <p className="text-uf-muted text-sm mt-2">{r.description}</p>
                {r.fileMeta?.fileName ? (
                  <p className="text-uf-muted text-xs mt-1 font-mono break-all">
                    {r.fileMeta.fileName}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.fileUrl ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReader({
                            url: r.fileUrl!,
                            name: r.fileMeta?.fileName ?? r.title,
                          });
                        }}
                        className="uf-btn uf-btn--primary"
                      >
                        Read document
                        {r.fileMeta?.byteSize
                          ? ` · ${formatBytes(r.fileMeta.byteSize)}`
                          : ""}
                      </button>
                      <a
                        href={r.fileUrl}
                        download
                        onClick={(e) => e.stopPropagation()}
                        className="uf-btn uf-btn--ghost"
                      >
                        Download
                      </a>
                    </>
                  ) : null}
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="uf-btn uf-btn--ghost"
                    >
                      Open resource ↗
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : null}
                  {!r.fileUrl && !r.url ? (
                    <div className="w-full rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] px-3 py-2">
                      <p className="text-xs font-mono uppercase tracking-wider text-uf-muted">
                        Document pending
                      </p>
                      <p className="text-[11px] text-uf-muted/80 mt-0.5">
                        This record is registered but its file hasn't been
                        uploaded yet — check back soon.
                      </p>
                    </div>
                  ) : null}
                </div>
              </HoloCard>
            ))}
            {items === undefined && [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="uf-skeleton" style={{ height: 180 }} />)}
          </div>
        )}
      </section>

      {/* On-page document reader — opens guides here instead of downloading */}
      <DocViewer
        url={reader?.url ?? null}
        fileName={reader?.name ?? null}
        onClose={() => setReader(null)}
      />
    </SiteShell>
  );
}
