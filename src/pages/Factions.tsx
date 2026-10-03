import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
} from "@/components/uf";
import { FactionIcon } from "@/components/factions/FactionIcon";
import { ScaleReveal } from "@/hooks/use-scroll-reveal";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Flag, Map as MapIcon, PenLine, Users } from "lucide-react";

// =========================================================================
// Faction Profiles — the canon faction registry as a public database page.
//
// Data comes from the operator-managed `factions` table (Operator Console →
// Factions), so this page doubles as (a) a reference surface for creators
// drafting faction-aligned lore and (b) the destination of the Creator Hub's
// "Faction Profiles" card. Members propose new faction dossiers through the
// Creator Hub; every entry clears operator approval before publication.
// =========================================================================

const CATEGORY_LABELS: Record<string, string> = {
  internal: "Internal Human Factions",
  orion: "Orion Triangle",
  fleet: "Fleet Commands",
  species: "Species Delegates",
};

type FactionRow = {
  _id?: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  accent: string;
  icon?: string;
  order: number;
  active?: boolean;
};

export default function Factions() {
  usePageMeta({
    title: "Faction Profiles — Star Force Base 1198",
    description:
      "The canon faction registry: human powers, Orion Triangle bodies, fleet commands, and species delegations of the Ultra Force universe.",
  });

  const data = useQuery(api.factions.listAll, {});
  const [cat, setCat] = useState("");

  const rows = useMemo(
    () => ((data?.items ?? []) as unknown as FactionRow[]).filter((f) => f.active !== false),
    [data],
  );

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const f of rows) {
      if (f.category && !seen.includes(f.category)) seen.push(f.category);
    }
    return seen;
  }, [rows]);

  const filtered = useMemo(
    () => (cat ? rows.filter((f) => f.category === cat) : rows),
    [rows, cat],
  );

  return (
    <SiteShell>
      <PageHero
        eyebrow="Faction Profiles"
        title="Powers, blocs, and command structures."
        lead="The canon faction registry — every power aligned with or opposed to the fleet. Read a dossier before you draft: faction, allegiance, and accent all belong in your entries."
        primary={{ label: "Draft a faction entry", href: "/creator", variant: "primary" }}
        secondary={{ label: "Chart the Star Atlas", href: "/map", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="uf-eyebrow uf-eyebrow--gold">Faction database</span>
            <h2 className="text-2xl font-semibold mt-1">
              {rows.length} factions on file
            </h2>
          </div>
          <Link to="/creator" className="text-uf-cyan text-sm">
            Use these in an entry →
          </Link>
        </header>

        {/* Category filter */}
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filter factions by category">
          {[["", "All factions"], ...categories.map((c) => [c, CATEGORY_LABELS[c] ?? c])].map(
            ([value, label]) => (
              <button
                key={value || "all"}
                type="button"
                aria-pressed={cat === value}
                className={`uf-pill ${cat === value ? "shadow-[var(--uf-glow-cyan)]" : ""}`}
                onClick={() => setCat(value)}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {data === undefined ? (
          <div className="uf-grid uf-grid--3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 160 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="uf-empty">No factions in this category yet.</div>
        ) : (
          <div className="uf-grid uf-grid--3">
            {filtered.map((f, idx) => (
              <ScaleReveal key={f._id ?? f.slug} staggerIndex={idx}>
                <HoloCard
                  className="h-full transition-colors"
                  style={{ borderTop: `3px solid ${f.accent || "var(--uf-gold)"}` }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-md"
                      style={{
                        border: `1px solid ${f.accent || "rgba(0,229,255,0.35)"}`,
                        background: `${f.accent || "#00E5FF"}14`,
                      }}
                    >
                      <FactionIcon
                        name={f.icon}
                        accent={f.accent}
                        className="h-5 w-5"
                      />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold leading-tight">{f.name}</h3>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <StatusPill variant="info">
                          {CATEGORY_LABELS[f.category] ?? f.category}
                        </StatusPill>
                      </div>
                    </div>
                  </div>
                  <p className="text-uf-muted text-sm mt-3">{f.description}</p>
                </HoloCard>
              </ScaleReveal>
            ))}
          </div>
        )}

        {/* Two-birds note: same registry, both directions */}
        <div className="mt-8">
          <HoloCard>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <Flag className="h-5 w-5 text-uf-gold shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold">
                    This registry cuts both ways
                  </h3>
                  <p className="text-uf-muted text-sm mt-1 max-w-3xl">
                    Operators maintain the faction list (Operator Console →
                    Factions), and it doubles as a drafting resource: cite a
                    faction here while you build characters, ships, and events.
                    Want to add a faction dossier? Draft it in the Creator Hub —
                    every entry clears operator approval before it's published to
                    the archive.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/creator">
                  <NeonButton variant="gold">
                    <PenLine className="h-4 w-4" aria-hidden /> Open the Creator Hub
                  </NeonButton>
                </Link>
                <Link to="/map">
                  <NeonButton variant="ghost">
                    <MapIcon className="h-4 w-4" aria-hidden /> Faction territory
                  </NeonButton>
                </Link>
                <Link to="/groups?category=faction">
                  <NeonButton variant="ghost">
                    <Users className="h-4 w-4" aria-hidden /> Join a faction group
                  </NeonButton>
                </Link>
              </div>
            </div>
          </HoloCard>
        </div>
      </section>
    </SiteShell>
  );
}
