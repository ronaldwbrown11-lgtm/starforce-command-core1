import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

// Optional custom insignia: drop the real emblem image at
// src/assets/honor-insignia.(png|jpg|webp) and it replaces the drawn
// medallion automatically — no code change needed.
const INSIGNIA_ASSETS = import.meta.glob("@/assets/honor-insignia.*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const INSIGNIA_URL = Object.values(INSIGNIA_ASSETS)[0] ?? null;

// ---------------------------------------------------------------------------
// /honor — the Wall of Honor.
//
// Matches the approved design: a winged-emblem banner, a caps subtitle
// strip, and a dense grid of light metallic plaques with dark navy text.
// Each plaque, centered: rank-abbr + pilot name, full rank, the chosen
// StarCraft fighter, the custom ship name in quotes, and the auto-sequential
// hull number. Flat and text-only — the names are the decoration.
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
  Recruit: "RCT.",
  Aspirant: "ASP.",
  Pilot: "LT.",
  Ensign: "ENS.",
  "Lieutenant Junior Grade": "LT.J.G.",
  Lieutenant: "LT.",
  "Lieutenant Commander": "LT.CMDR.",
  Major: "MAJ.",
  Commander: "CDR.",
  Captain: "CPT.",
  Colonel: "COL.",
  Admiral: "ADM.",
};

/** Winged-star medallion — operator upload, bundled asset, or drawn. */
function WingedEmblem({ customUrl }: { customUrl: string | null }) {
  const url = customUrl ?? INSIGNIA_URL;
  if (url) {
    return (
      <img
        src={url}
        alt="Star Force Base 1198 insignia"
        className="h-24 w-auto mx-auto sm:h-28 drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 240 150"
      className="h-24 w-auto mx-auto sm:h-28"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="hof-steel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f8fc" />
          <stop offset="45%" stopColor="#c6d0dd" />
          <stop offset="100%" stopColor="#7e8ba0" />
        </linearGradient>
        <linearGradient id="hof-steel2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbe3ee" />
          <stop offset="100%" stopColor="#66748c" />
        </linearGradient>
        <linearGradient id="hof-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f3e2a0" />
          <stop offset="100%" stopColor="#b98d2c" />
        </linearGradient>
        <linearGradient id="hof-ring" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#94a1b6" />
          <stop offset="50%" stopColor="#3c4658" />
          <stop offset="100%" stopColor="#94a1b6" />
        </linearGradient>
      </defs>

      {/* outer medallion ring */}
      <circle cx="120" cy="70" r="46" fill="none" stroke="url(#hof-ring)" strokeWidth="7" />
      <circle cx="120" cy="70" r="39" fill="none" stroke="#55617a" strokeWidth="1.2" />
      {/* tick marks on the ring */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        const r1 = 42.5;
        const r2 = i % 2 === 0 ? 47.5 : 45.5;
        return (
          <line
            key={i}
            x1={120 + Math.cos(a) * r1}
            y1={70 + Math.sin(a) * r1}
            x2={120 + Math.cos(a) * r2}
            y2={70 + Math.sin(a) * r2}
            stroke={i % 4 === 0 ? "url(#hof-gold)" : "#6d7a92"}
            strokeWidth={i % 4 === 0 ? 1.6 : 1}
          />
        );
      })}
      {/* inner dial */}
      <circle cx="120" cy="70" r="33" fill="#10192b" stroke="#33405a" strokeWidth="1.4" />
      {/* gold orbit ellipse */}
      <ellipse
        cx="120"
        cy="70"
        rx="34"
        ry="13"
        fill="none"
        stroke="url(#hof-gold)"
        strokeWidth="1.5"
        transform="rotate(-18 120 70)"
      />

      {/* wings — upper pair */}
      <path
        d="M112 52 C88 26 48 20 14 34 C40 38 62 48 80 62 C92 70 104 72 114 66 Z"
        fill="url(#hof-steel)"
        stroke="#4c5a72"
        strokeWidth="1.1"
      />
      <path
        d="M128 52 C152 26 192 20 226 34 C200 38 178 48 160 62 C148 70 136 72 126 66 Z"
        fill="url(#hof-steel)"
        stroke="#4c5a72"
        strokeWidth="1.1"
      />
      {/* wings — lower pair */}
      <path
        d="M112 66 C92 54 64 52 38 62 C60 66 78 74 92 84 C100 90 110 90 116 84 Z"
        fill="url(#hof-steel2)"
        stroke="#4c5a72"
        strokeWidth="1"
      />
      <path
        d="M128 66 C148 54 176 52 202 62 C180 66 162 74 148 84 C140 90 130 90 124 84 Z"
        fill="url(#hof-steel2)"
        stroke="#4c5a72"
        strokeWidth="1"
      />

      {/* central star */}
      <path
        d="M120 30 L126.5 51 L148.5 51.5 L131 64.5 L137.5 85.5 L120 73 L102.5 85.5 L109 64.5 L91.5 51.5 L113.5 51 Z"
        fill="url(#hof-gold)"
        stroke="#6d5313"
        strokeWidth="1.2"
      />
      {/* dagger below the star */}
      <path
        d="M120 88 L124 100 L120 122 L116 100 Z"
        fill="url(#hof-steel)"
        stroke="#4c5a72"
        strokeWidth="0.9"
      />

      {/* banner — base name */}
      <path
        d="M74 112 C96 122 144 122 166 112 L166 128 C144 138 96 138 74 128 Z"
        fill="url(#hof-steel2)"
        stroke="#3f4b61"
        strokeWidth="1"
      />
      <text
        x="120"
        y="125"
        textAnchor="middle"
        fontSize="11.5"
        fontWeight="800"
        letterSpacing="1"
        fill="#0c1424"
      >
        STARFORCE BASE 1198
      </text>
      {/* motto ribbon */}
      <text
        x="120"
        y="143"
        textAnchor="middle"
        fontSize="8"
        fontWeight="600"
        letterSpacing="2.2"
        fill="#9fb0c8"
      >
        AETERNAM FORTIS
      </text>
    </svg>
  );
}

export default function HonorWall() {
  usePageMeta({
    title: "Wall of Honor: Decorated Starfighter Commanders — Star Force Base 1198",
    description:
      "Decorated commanders of the Star Force: their rank, their StarCraft fighter, their custom ship name, and their hull number. Written once, forever.",
  });

  const rows = useQuery(api.starfighters.honorWall) as Plaque[] | undefined;
  const insignia = useQuery(api.starfighters.getWallInsignia, {});

  return (
    <SiteShell>
      <div className="min-h-[70vh] bg-[#0a1120]">
        {/* ---- Banner header ---- */}
        <header className="border-b border-[rgba(148,163,184,0.18)] bg-gradient-to-b from-[#0e1729] to-[#0a1120] px-4 py-8 sm:py-10 text-center">
          <WingedEmblem customUrl={insignia?.url ?? null} />
          <h1 className="mt-3 text-xl sm:text-3xl lg:text-4xl font-bold tracking-[0.06em] text-white uppercase">
            Wall of Honor:{" "}
            <span className="text-[#dbe4f0]">Decorated Starfighter Commanders</span>
          </h1>
        </header>

        {/* ---- Subtitle strip ---- */}
        <div className="px-4 pt-5">
          <p className="mx-auto max-w-4xl rounded-sm border border-[rgba(148,163,184,0.25)] bg-[rgba(59,86,130,0.35)] px-4 py-2 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-[#c7d5e8]">
            Recognizing members who have earned their wings and selected their
            custom StarCraft fighters
          </p>
        </div>

        {/* ---- The wall ---- */}
        <section className="px-3 sm:px-5 py-6">
          {rows === undefined ? (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 list-none p-0 m-0">
              {Array.from({ length: 14 }).map((_, i) => (
                <li
                  key={i}
                  className="h-28 rounded-md bg-[rgba(148,163,184,0.12)] animate-pulse"
                />
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <div className="mx-auto max-w-lg rounded-md border border-[rgba(148,163,184,0.25)] bg-[rgba(17,26,44,0.7)] p-10 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#dbe4f0]">
                The wall awaits its first plaque
              </p>
              <p className="mt-2 text-xs text-[#8fa3bf] leading-5">
                When the first wings are earned at the Wings ceremony, the
                pilot's fighter, ship name, and hull number are engraved here —
                permanently.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2.5 list-none p-0 m-0">
              {rows.map((p) => (
                <HonorPlaque key={p._id} plaque={p} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// One plaque — light metallic steel with dark navy centered text.
// ---------------------------------------------------------------------------

function HonorPlaque({ plaque: p }: { plaque: Plaque }) {
  const abbr = p.memberRank ? RANK_ABBR[p.memberRank] ?? null : null;
  const name = p.memberName.toUpperCase();

  return (
    <li
      className="rounded-md border border-[#8b98ab] bg-gradient-to-b from-[#f0f4f9] via-[#d5dde8] to-[#b7c2d2] px-2 py-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_2px_6px_rgba(2,6,17,0.55)]"
    >
      {/* pilot line: rank abbr + name */}
      <p className="text-[11px] sm:text-xs font-bold leading-tight text-[#0b1220] break-words">
        {abbr ? `${abbr} ` : ""}
        {name}
      </p>
      {/* full rank */}
      {p.memberRank ? (
        <p className="mt-0.5 text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.08em] text-[#3b4a63]">
          {p.memberRank}
        </p>
      ) : null}
      {/* the chosen StarCraft fighter */}
      <p className="mt-1.5 text-[10px] sm:text-[11px] font-bold uppercase leading-tight text-[#12203a] break-words">
        {p.designation}
      </p>
      {/* custom ship name */}
      <p className="mt-1 text-[10px] sm:text-[11px] font-bold text-[#0b1220] break-words">
        “{p.callsign}”
      </p>
      {/* hull number */}
      <p className="mt-1.5 font-mono text-[9px] sm:text-[10px] tracking-[0.08em] text-[#42536f]">
        {p.hullNumber}
      </p>
    </li>
  );
}
