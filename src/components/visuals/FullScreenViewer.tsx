import { useEffect } from "react";
import { Link } from "react-router";
import { Download, X } from "lucide-react";
import { CanonBadge } from "./CanonBadge";
import type { VisualAssetDoc } from "./AssetGrid";

// =========================================================================
// FullScreenViewer — holographic lightbox for the Canon Image Library,
// Artist Profiles, and the Missions Deck.
//
// FUTURE FEATURE — DO NOT IMPLEMENT IN THIS BUILD:
//   comment threads, markup/annotation tools (draw, highlight), artist
//   mentions on the image. The viewer stays read-only in this build.
// =========================================================================

export function FullScreenViewer({
  asset,
  onClose,
}: {
  asset: VisualAssetDoc | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!asset) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asset, onClose]);

  if (!asset) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={asset.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,11,26,0.92)] backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="sf-glass sf-panel-in w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold sf-head truncate">
                {asset.title}
              </h2>
              <CanonBadge status={asset.status} />
            </div>
            <p className="text-uf-muted text-sm mt-1 flex flex-wrap gap-x-3">
              {asset.attribution ? <span>Artist: {asset.attribution}</span> : null}
              <span className="uppercase tracking-[0.12em]">{asset.kind}</span>
              {asset.medium ? <span>{asset.medium}</span> : null}
              {asset.folder ? <span>Gallery: {asset.folder}</span> : null}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close viewer"
            onClick={onClose}
            className="uf-btn uf-btn--ghost shrink-0"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {asset.url ? (
          <img
            src={asset.url}
            alt={asset.title}
            className="w-full max-h-[62vh] object-contain rounded-lg border border-[rgba(230,168,23,0.35)] bg-[rgba(2,11,26,0.6)]"
          />
        ) : null}

        {asset.description ? (
          <p className="text-sm leading-relaxed mt-3 whitespace-pre-wrap">
            {asset.description}
          </p>
        ) : null}

        {asset.status === "needs_revision" && asset.reviewNote ? (
          <p className="text-[#F3C849] text-sm mt-3 border border-[rgba(243,200,73,0.4)] bg-[rgba(243,200,73,0.08)] rounded-md px-3 py-2">
            Reviewer note: {asset.reviewNote}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <CanonTag label="Species" value={asset.species} />
          <CanonTag label="Technology" value={asset.technology} />
          <CanonTag label="Faction" value={asset.faction} />
          <CanonTag label="Mission" value={asset.mission} />
          <CanonTag label="Era" value={asset.era} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            to={`/artists/${asset.authorId}`}
            className="uf-btn uf-btn--ghost text-xs"
          >
            Artist profile
          </Link>
          {asset.downloadAllowed && asset.url ? (
            <a
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              download
              className="uf-btn uf-btn--goldline text-xs"
            >
              <Download className="h-4 w-4" aria-hidden /> Download
            </a>
          ) : (
            <span className="text-uf-muted text-xs">
              Downloads disabled by the artist.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CanonTag({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <span className="uf-pill">
      {label}: {value}
    </span>
  );
}
