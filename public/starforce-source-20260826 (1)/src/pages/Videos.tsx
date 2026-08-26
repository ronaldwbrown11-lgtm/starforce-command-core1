import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { useState } from "react";

import { usePageMeta } from "@/hooks/use-page-meta";
type Transmission = Doc<"transmissions"> & {
  coverUrl?: string | null;
  fileUrl?: string | null;
};

// Resolve which source actually plays: an operator-uploaded video file first,
// falling back to an external URL (YouTube / Vimeo / direct .mp4 link).
function playableUrl(t: Transmission): string | null {
  return t.fileUrl ?? t.videoUrl ?? null;
}

function embedUrl(url: string): { kind: "embed"; src: string } | { kind: "video"; src: string } | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "embed", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { kind: "embed", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  if (/\.(mp4|webm|ogg|ogv|m4v)(\?.*)?$/i.test(url)) return { kind: "video", src: url };
  return null;
}

function Player({ url, title, directVideo }: { url: string; title: string; directVideo?: boolean }) {
  // Operator-uploaded files (Convex storage URLs) are always direct video.
  if (directVideo) {
    return (
      <video src={url} controls preload="metadata" className="absolute inset-0 h-full w-full object-contain bg-black" />
    );
  }
  const parsed = embedUrl(url);
  if (!parsed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <a href={url} target="_blank" rel="noopener noreferrer" className="uf-btn uf-btn--primary">
          Watch on external site
        </a>
      </div>
    );
  }
  if (parsed.kind === "embed") {
    return (
      <iframe
        src={parsed.src}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <video src={parsed.src} controls preload="metadata" className="absolute inset-0 h-full w-full object-contain bg-black" />
  );
}

export default function Videos() {
  const featured = useQuery(api.content.featuredTransmission);
  const list = useQuery(api.content.listTransmissions, { limit: 12 });
  const [active, setActive] = useState<Transmission | null>(null);

  const renderThumb = (t: Transmission) => {
    const url = playableUrl(t);
    return url ? (
      <div className="relative aspect-video overflow-hidden">
        <Player url={url} title={t.title} directVideo={!!t.fileUrl} />
      </div>
    ) : (
      <div
        className="aspect-video mb-3 rounded-md flex items-center justify-center text-uf-muted text-xs uppercase tracking-[0.16em]"
        style={{ background: "linear-gradient(180deg, rgba(0,229,255,0.06), rgba(139,92,246,0.08))" }}
      >
        {t.transmissionType ?? "briefing"}
      </div>
    );
  };
  usePageMeta({ title: "Transmissions — Star Force Base 1198", description: "Watch fleet transmissions, mission briefings, and command broadcasts.", noindex: false });


  return (
    <SiteShell>
      <PageHero
        eyebrow="Transmissions"
        title="Audio/Visual Archive"
        lead="Featured briefings, mission recordings, lore deep-dives."
        primary={{ label: "Submit Story", href: "/submit", variant: "primary" }}
        secondary={{ label: "Watch Featured", href: "#featured", variant: "ghost" }}
      />
      <section id="featured" className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        {featured === undefined ? (
          <div className="uf-skeleton" style={{ height: 280 }} />
        ) : featured === null ? (
          <div className="uf-empty">No featured transmission yet.</div>
        ) : (
          <HoloCard className="!p-0 overflow-hidden">
            <div className="relative aspect-video bg-black">
              {playableUrl(featured) ? (
                <Player
                  url={playableUrl(featured)!}
                  title={featured.title}
                  directVideo={!!featured.fileUrl}
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-uf-muted text-[clamp(2rem,5vw,3.5rem)] font-semibold opacity-20 tracking-widest">
                  {featured.title}
                </span>
              )}
            </div>
            <div className="p-6">
              <header className="flex items-center justify-between mb-3">
                <h2 className="text-2xl font-semibold">{featured.title}</h2>
                <StatusPill variant="info">Featured</StatusPill>
              </header>
              <p className="text-uf-muted text-sm">{featured.description}</p>
              <p className="text-xs text-uf-muted mt-3">
                Duration: {featured.durationSeconds ? `${Math.round(featured.durationSeconds / 60)} min` : "—"} •
                Type: {featured.transmissionType ?? "briefing"}
              </p>
            </div>
          </HoloCard>
        )}
      </section>
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-6">
          <span className="uf-eyebrow">All transmissions</span>
          <h2 className="text-3xl font-semibold mt-2">
            {list === undefined ? "Loading…" : `${list.length} transmissions.`}
          </h2>
        </header>
        {list && list.length === 0 ? (
          <div className="uf-empty">No transmissions yet.</div>
        ) : (
          <div className="uf-grid uf-grid--3">
            {list?.map((t) => (
              <HoloCard key={t._id} className={playableUrl(t) ? "cursor-pointer transition-transform hover:-translate-y-1" : ""}>
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => playableUrl(t) && setActive(t)}
                  aria-label={playableUrl(t) ? `Watch ${t.title}` : undefined}
                >
                  {renderThumb(t)}
                </button>
                <h3 className="text-lg font-semibold">{t.title}</h3>
                <p className="text-uf-muted text-sm mt-2">{t.description}</p>
                {playableUrl(t) && (
                  <button
                    type="button"
                    className="mt-3 uf-btn uf-btn--ghost text-xs"
                    onClick={() => setActive(t)}
                  >
                    ▶ Watch
                  </button>
                )}
              </HoloCard>
            ))}
            {list === undefined && [0, 1, 2].map((i) => <div key={i} className="uf-skeleton" style={{ height: 220 }} />)}
          </div>
        )}
      </section>

      {active && playableUrl(active) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
        >
          <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-[color:var(--uf-border)]">
              <Player
                url={playableUrl(active)!}
                title={active.title}
                directVideo={!!active.fileUrl}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <h3 className="text-xl font-semibold">{active.title}</h3>
              <button
                type="button"
                className="uf-btn uf-btn--ghost"
                onClick={() => setActive(null)}
              >
                Close ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}
