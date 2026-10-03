import type { CSSProperties, ReactNode } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import goldPlateUrl from "@/assets/gold-plate-texture.jpg";
import { CanonBadge } from "./CanonBadge";

// =========================================================================
// AssetGrid — the shared gold-framed gallery grid for visual assets.
// Used by the Canon Image Library, Artist Profiles, and the Missions Deck.
// =========================================================================

export type VisualAssetDoc = Doc<"visualAssets"> & { url: string | null };

const GOLD_FRAME: CSSProperties = {
  backgroundImage: `linear-gradient(180deg, rgba(255,244,200,0.45) 0%, rgba(255,255,255,0) 35%, rgba(90,60,10,0.28) 100%), url(${goldPlateUrl})`,
  backgroundSize: "100% 100%, cover",
};

export function AssetGrid({
  assets,
  onOpen,
  empty = "No artwork matches those filters.",
  compact = false,
}: {
  assets: VisualAssetDoc[];
  onOpen: (asset: VisualAssetDoc) => void;
  empty?: ReactNode;
  compact?: boolean;
}) {
  if (assets.length === 0) return <p className="uf-empty">{empty}</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map((a, i) => (
        <button
          key={a._id}
          type="button"
          onClick={() => onOpen(a)}
          className="sf-panel-in text-left rounded-[14px] p-[3px] h-full w-full transition-transform hover:-translate-y-0.5"
          style={{ ...GOLD_FRAME, animationDelay: `${(i % 6) * 60}ms` }}
        >
          <div className="sf-glass rounded-[11px] overflow-hidden h-full flex flex-col">
            {a.url ? (
              <img
                src={a.url}
                alt={a.title}
                loading="lazy"
                className={`w-full object-cover ${compact ? "h-32" : "aspect-[4/3]"}`}
              />
            ) : (
              <div
                className={`w-full ${compact ? "h-32" : "aspect-[4/3]"} bg-[rgba(2,11,26,0.5)]`}
              />
            )}
            <div className="p-3 flex flex-col gap-1.5 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm leading-tight min-w-0">
                  {a.title}
                </p>
                <CanonBadge status={a.status} />
              </div>
              <p className="text-uf-muted text-xs mt-auto flex flex-wrap gap-x-2">
                {a.attribution ? <span>by {a.attribution}</span> : null}
                <span className="uppercase tracking-[0.12em]">{a.kind}</span>
                {a.medium ? <span>· {a.medium}</span> : null}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
