import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router";
import { ImagePlus } from "lucide-react";
import { NeonButton } from "@/components/uf";
import { AssetGrid, type VisualAssetDoc } from "./AssetGrid";
import { FullScreenViewer } from "./FullScreenViewer";
import { VisualUploader } from "./VisualUploader";

// =========================================================================
// MissionVisuals — the Missions Deck integration for the visual system:
// mission poster / mission patch / mission storyboard artwork, tagged to
// this mission through the global uploader (the missions schema itself is
// untouched — artwork lives in visualAssets with a mission tag).
// =========================================================================

export function MissionVisuals({
  missionKey,
  missionTitle,
}: {
  missionKey: string;
  missionTitle: string;
}) {
  const { isAuthenticated } = useAuth();
  const assets = useQuery(api.visuals.listAssets, { mission: missionKey });
  const [open, setOpen] = useState(false);
  const [viewer, setViewer] = useState<VisualAssetDoc | null>(null);

  const rows = (assets ?? []).filter((a) => a.url !== null) as VisualAssetDoc[];

  return (
    <section className="mt-8" id="artwork">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <span className="uf-eyebrow uf-eyebrow--gold sf-pulse-soft">
            Mission artwork
          </span>
          <h2 className="sf-head text-xl font-semibold mt-1">
            Posters, patches, and storyboard frames.
          </h2>
        </div>
        {isAuthenticated ? (
          <NeonButton
            variant="ghost"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            {open ? "Close uploader" : "Attach artwork"}
          </NeonButton>
        ) : (
          <Link to="/auth?returnTo=/missions" className="text-uf-cyan text-sm">
            Sign in to attach artwork →
          </Link>
        )}
      </header>

      {open ? (
        <VisualUploader
          defaults={{ mission: missionKey, kind: "poster", title: `${missionTitle} — ` }}
          onUploaded={() => setOpen(false)}
          submitLabel="Submit mission artwork"
          className="mb-6"
        />
      ) : null}

      {assets === undefined ? (
        <div className="uf-grid uf-grid--3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="uf-skeleton" style={{ height: 160 }} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="uf-empty">
          No approved artwork yet — be the first to illustrate this operation.
        </div>
      ) : (
        <AssetGrid assets={rows} onOpen={setViewer} compact />
      )}

      <FullScreenViewer asset={viewer} onClose={() => setViewer(null)} />
    </section>
  );
}
