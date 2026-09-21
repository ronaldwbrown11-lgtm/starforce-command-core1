import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Medal, Award, Shield, Sparkles } from "lucide-react";
import { StatusPill } from "../uf";
import { HoloCard } from "../uf/Panel";

// ---------------------------------------------------------------------------
// RibbonRack — a member's conferred service ribbons, badges, and medals.
// Prefers the operator-uploaded insignia image; falls back to a procedural
// category glyph when no art has been uploaded. The compact variant renders
// a single-row strip for dossier headers.
// ---------------------------------------------------------------------------

const CATEGORY_ICON: Record<string, typeof Medal> = {
  ribbon: Award,
  badge: Shield,
  medal: Medal,
};

const CATEGORY_CLASS: Record<string, string> = {
  ribbon: "text-uf-cyan border-[rgba(0,229,255,0.4)]",
  badge: "text-uf-violet border-[rgba(139,92,246,0.4)]",
  medal: "text-[color:var(--uf-gold,#e6a817)] border-[rgba(230,168,23,0.45)]",
};

export type RibbonRackEntry = {
  awardId: string;
  name: string;
  category: string;
  description: string;
  citation: string | null;
  awardedAt: number;
  imageUrl: string | null;
};

export function RibbonRack({
  userId,
  entries,
  compact = false,
  limit,
}: {
  /** Pass either a userId (self-fetching) or preloaded entries. */
  userId?: string;
  entries?: RibbonRackEntry[] | null;
  compact?: boolean;
  limit?: number;
}) {
  const fetched = useQuery(
    api.honors.memberRibbonRack,
    !entries && userId ? { userId: userId as Id<"users"> } : "skip",
  );
  const rows = (entries ?? fetched ?? []) as RibbonRackEntry[];
  const visible = limit ? rows.slice(0, limit) : rows;

  if (rows.length === 0) {
    if (compact) return null;
    return (
      <HoloCard>
        <div className="flex items-start gap-3">
          <Award className="h-6 w-6 text-uf-muted shrink-0" aria-hidden />
          <div>
            <h3 className="text-lg font-semibold">No honors yet.</h3>
            <p className="text-uf-muted text-sm mt-1">
              Service ribbons, badges, and medals are conferred by the Bridge for
              contributions to the fleet — publish lore, chart the atlas, serve well.
            </p>
          </div>
        </div>
      </HoloCard>
    );
  }

  if (compact) {
    return (
      <ul
        className="flex flex-wrap items-center gap-1.5 list-none p-0 m-0"
        aria-label={`Ribbon rack: ${rows.length} honors`}
      >
        {visible.map((h) => {
          const Icon = CATEGORY_ICON[h.category] ?? Award;
          return (
            <li
              key={h.awardId}
              title={`${h.name}${h.citation ? ` — ${h.citation}` : ""}`}
              className={`inline-grid place-items-center h-8 w-10 rounded-sm border bg-[rgba(16,24,39,0.6)] ${CATEGORY_CLASS[h.category] ?? CATEGORY_CLASS.ribbon}`}
            >
              {h.imageUrl ? (
                <img src={h.imageUrl} alt={h.name} className="w-full h-full object-cover rounded-sm" />
              ) : (
                <Icon className="h-4 w-4" aria-hidden />
              )}
            </li>
          );
        })}
        {rows.length > visible.length && (
          <li className="text-xs text-uf-muted">+{rows.length - visible.length}</li>
        )}
      </ul>
    );
  }

  return (
    <div className="uf-grid uf-grid--2">
      {visible.map((h) => {
        const Icon = CATEGORY_ICON[h.category] ?? Award;
        return (
          <HoloCard key={h.awardId} className="h-full">
              <div className="flex items-start gap-3">
                <div
                  className={`shrink-0 w-16 h-10 rounded-sm border grid place-items-center bg-[rgba(16,24,39,0.6)] ${CATEGORY_CLASS[h.category] ?? CATEGORY_CLASS.ribbon}`}
                >
                  {h.imageUrl ? (
                    <img
                      src={h.imageUrl}
                      alt={h.name}
                      className="w-full h-full object-cover rounded-sm"
                    />
                  ) : (
                    <Icon className="h-5 w-5" aria-hidden />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold">{h.name}</h4>
                    <StatusPill variant={h.category === "medal" ? "gold" : h.category === "badge" ? "violet" : "cyan"}>
                      {h.category}
                    </StatusPill>
                  </div>
                  <p className="text-sm text-uf-muted mt-1">{h.description}</p>
                  {h.citation && (
                    <p className="text-xs mt-1 italic text-[color:var(--uf-text)]">
                      “{h.citation}”
                    </p>
                  )}
                  <time
                    dateTime={new Date(h.awardedAt).toISOString()}
                    className="text-xs text-uf-muted block mt-1"
                  >
                    Conferred{" "}
                    {new Date(h.awardedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </div>
              </div>
          </HoloCard>
        );
      })}
    </div>
  );
}

/** Full awards display catalog — for the /awards page. */
export function AwardsCatalog() {
  const honors = useQuery(api.honors.listHonorsPublic, {});
  if (honors === undefined) {
    return <div className="uf-skeleton" style={{ height: 220 }} aria-hidden />;
  }
  if (honors.length === 0) {
    return (
      <HoloCard>
        <div className="flex items-start gap-3">
          <Sparkles className="h-6 w-6 text-uf-muted shrink-0" aria-hidden />
          <div>
            <h3 className="text-lg font-semibold">The honors catalog is being drafted.</h3>
            <p className="text-uf-muted text-sm mt-1">
              Command is formalizing the decorations of the fleet. Watch this page — the
              first ribbons will appear here soon.
            </p>
          </div>
        </div>
      </HoloCard>
    );
  }
  const groups: Array<{ key: string; label: string; blurb: string }> = [
    { key: "medal", label: "Medals", blurb: "The fleet's highest decorations." },
    { key: "ribbon", label: "Service Ribbons", blurb: "Earned through verified contribution." },
    { key: "badge", label: "Achievement Badges", blurb: "Marks of specialty and service." },
  ];
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => {
        const rows = honors.filter((h) => h.category === g.key);
        if (rows.length === 0) return null;
        return (
          <section key={g.key} aria-labelledby={`awards-${g.key}`}>
            <h2 id={`awards-${g.key}`} className="text-2xl font-semibold tracking-tight">
              {g.label}
            </h2>
            <p className="text-uf-muted text-sm mt-1 mb-4">{g.blurb}</p>
            <ul className="uf-grid uf-grid--3 list-none p-0 m-0">
              {rows.map((h) => (
                <li key={h._id}>
                  <HoloCard className="h-full">
                    <div className="flex items-start gap-3">
                      <div
                        className={`shrink-0 w-14 h-9 rounded-sm border grid place-items-center bg-[rgba(16,24,39,0.6)] ${CATEGORY_CLASS[h.category] ?? CATEGORY_CLASS.ribbon}`}
                      >
                        {h.hasImage ? (
                          <HonorImg honorId={h._id} name={h.name} />
                        ) : (
                          <CatalogGlyph category={h.category} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold">{h.name}</h3>
                        <p className="text-sm text-uf-muted mt-1">{h.description}</p>
                        <p className="uf-eyebrow mt-2">
                          {h.holders} holder{h.holders === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  </HoloCard>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CatalogGlyph({ category }: { category: string }) {
  const Icon = CATEGORY_ICON[category] ?? Award;
  return <Icon className="h-4 w-4" aria-hidden />;
}

function HonorImg({ honorId, name }: { honorId: string; name: string }) {
  const url = useQuery(api.honors.honorImageUrl, { id: honorId as Id<"honors"> });
  if (!url) return <Award className="h-4 w-4 text-uf-muted" aria-hidden />;
  return <img src={url} alt={name} className="w-full h-full object-cover rounded-sm" />;
}
