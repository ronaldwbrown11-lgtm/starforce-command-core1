import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Feather, Search } from "lucide-react";

// ---------------------------------------------------------------------------
// /honor — the Wall of Honor.
//
// Flat, text-focused plaque grid: every pilot who earned their wings, the
// fighter type they chose, their callsign, and their auto-sequential hull
// number. No member photos, no expandable accordions, no decorative chrome —
// the names and their hulls are the decoration. Plaques are newest-first;
// the pilot's own plaque is highlighted when signed in.
// ---------------------------------------------------------------------------

type Plaque = {
  _id: string;
  memberName: string;
  memberRank: string | null;
  memberId: string;
  designation: string;
  shipClass: string | null;
  callsign: string;
  hullNumber: string;
  awardedAt: number;
};

const RANK_ABBR: Record<string, string> = {
  Recruit: "RCT",
  Aspirant: "ASP",
  Pilot: "FLT",
  Commander: "CDR",
  Captain: "CPT",
  Admiral: "ADM",
};

function formatPilotLine(name: string, rank: string | null): string {
  const abbr = rank ? RANK_ABBR[rank] ?? rank.toUpperCase() : null;
  return abbr ? `${abbr}. ${name}` : name;
}

export default function HonorWall() {
  usePageMeta({
    title: "Wall of Honor — Star Force Base 1198",
    description:
      "Every pilot who earned their wings: their fighter, their callsign, their hull number. Written once, forever.",
  });

  const rows = useQuery(api.starfighters.honorWall) as Plaque[] | undefined;
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.memberName.toLowerCase().includes(q) ||
        r.callsign.toLowerCase().includes(q) ||
        r.designation.toLowerCase().includes(q) ||
        r.hullNumber.toLowerCase().includes(q),
    );
  }, [rows, search]);

  return (
    <SiteShell>
      <PageHero
        eyebrow="The Permanent Honor"
        title="Wall of Honor."
        lead="Every plaque is a pilot who earned their wings — their fighter, their callsign, their hull. Written once at the Wings ceremony. Never edited, never revoked."
        primary={{ label: "How wings are earned", href: "/awards#wings", variant: "primary" }}
        secondary={{ label: "The fleet registry", href: "/fleet-registry", variant: "ghost" }}
      />

      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-uf-muted">
            {filtered ? `${filtered.length} pilots on the wall` : "Loading the wall…"}
          </p>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-uf-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pilot, callsign, hull…"
              aria-label="Search the Wall of Honor"
              className="uf-input w-full pl-9"
            />
          </div>
        </div>

        {filtered === null ? (
          <div className="uf-skeleton" style={{ height: 240 }} />
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-[color:var(--uf-border)] bg-[rgba(10,14,26,0.6)] p-12 text-center">
            <Feather className="h-6 w-6 text-[#ffcc00] mx-auto" />
            <h2 className="mt-3 font-semibold">The wall awaits its first plaque.</h2>
            <p className="text-uf-muted text-sm mt-2 max-w-md mx-auto">
              When the first wings are earned at the ceremony, the pilot's
              fighter, callsign, and hull number are engraved here — permanently.
            </p>
            <Link to="/awards#wings" className="uf-btn uf-btn--ghost mt-5 inline-block text-sm">
              How wings are earned
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 list-none p-0 m-0">
            {filtered.map((p) => (
              <HonorPlaque key={p._id} plaque={p} />
            ))}
          </ul>
        )}
      </section>
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// One plaque. Uniform, text-only: pilot line, type, callsign, hull number.
// ---------------------------------------------------------------------------

function HonorPlaque({ plaque: p }: { plaque: Plaque }) {
  return (
    <li className="group relative rounded-lg border border-[rgba(203,213,225,0.22)] bg-[rgba(10,14,26,0.72)] p-5 transition-all hover:border-[rgba(255,204,0,0.45)] hover:shadow-[0_0_22px_rgba(255,204,0,0.10)]">
      {/* subtle top accent line */}
      <span
        aria-hidden
        className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,204,0,0.5)] to-transparent opacity-60"
      />
      {/* hull number — the plate's serial */}
      <p className="font-mono text-[11px] tracking-[0.22em] text-uf-muted">
        {p.hullNumber}
      </p>
      {/* pilot name & rank */}
      <h2 className="mt-2 text-[15px] font-semibold leading-snug text-uf-text break-words">
        {formatPilotLine(p.memberName, p.memberRank)}
      </h2>
      {/* selected StarCraft fighter */}
      <p className="mt-2 text-sm text-[#9fb6d4] leading-snug break-words">
        {p.designation}
        {p.shipClass ? (
          <span className="block text-xs text-uf-muted mt-0.5">{p.shipClass}</span>
        ) : null}
      </p>
      {/* callsign — the ship name the pilot chose */}
      <p className="mt-3 font-mono text-sm tracking-[0.18em] text-[#ffcc00]">
        {p.callsign}
      </p>
    </li>
  );
}
