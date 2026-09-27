import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell } from "@/components/uf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePageMeta } from "@/hooks/use-page-meta";
import goldPlateUrl from "@/assets/gold-plate-texture.jpg";

// Optional bundled insignia: src/assets/honor-insignia.(png|jpg|webp) — used
// only when the operator has not uploaded the official emblem via the console.
const INSIGNIA_ASSETS = import.meta.glob("@/assets/honor-insignia.*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const INSIGNIA_URL = Object.values(INSIGNIA_ASSETS)[0] ?? null;

// ===========================================================================
// TEMPLATE MODES — drop a file into public/assets/ and it takes over /honor:
//
//   1. honor-wall-blank.jpg      ← BEST: the reference artwork with EMPTY
//      (gold plates, no text/ships) plates. The live database records are
//      rendered onto the 21 plate slots, so it looks exactly like the
//      reference AND updates automatically as members earn wings.
//
//   2. honor-wall-reference.jpg  ← EXACT COPY: the finished mockup shown
//      as-is, pixel-perfect (static — no live data).
//
//   3. (no file)                 ← the built gold display case below.
//
// === CALIBRATION (blank template overlay) — tweak these if the overlay ===
// === sits off the plates; they are percentages of the image dimensions ===
// ===========================================================================
const BLANK_SRC = "/assets/honor-wall-blank.jpg";
const REFERENCE_SRC = "/assets/honor-wall-reference.jpg";
const WALL_AREA = { left: 4.3, top: 34.0, right: 95.7, bottom: 85.3 }; // % of image
const COLS = 7;
const ROWS = 3;
const CELL_INSET = 0.55; // % of image, padding inside each plate slot

type Plaque = {
  _id: string;
  memberName: string;
  memberRank: string | null;
  memberId: string;
  vesselKey: string;
  designation: string;
  shipClass: string | null;
  callsign: string;
  hullNumber: string;
  imageUrl: string | null;
  awardedAt: number;
};

const RANK_ABBR: Record<string, string> = {
  Recruit: "RCT.",
  Aspirant: "ASP.",
  Pilot: "LT.",
  Ensign: "ENS.",
  "Lieutenant Junior Grade": "LT.J.G.",
  Lieutenant: "LT.",
  "Lieutenant Colonel": "LT.COL.",
  "Lieutenant Commander": "LT.CMDR.",
  Major: "MAJ.",
  Commander: "CDR.",
  Captain: "CPT.",
  Colonel: "COL.",
  Admiral: "ADM.",
};

function rankAbbr(rank: string | null): string | null {
  if (!rank) return null;
  return RANK_ABBR[rank] ?? `${rank.toUpperCase()}.`;
}

/** Probe public/assets for the operator's template images at runtime. */
function useTemplateMode(): "checking" | "blank" | "reference" | "none" {
  const [mode, setMode] = useState<"checking" | "blank" | "reference" | "none">("checking");
  useEffect(() => {
    let alive = true;
    const probe = (src: string) =>
      new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      });
    (async () => {
      if (await probe(`${BLANK_SRC}?v=1`)) {
        if (alive) setMode("blank");
        return;
      }
      if (await probe(`${REFERENCE_SRC}?v=1`)) {
        if (alive) setMode("reference");
        return;
      }
      if (alive) setMode("none");
    })();
    return () => {
      alive = false;
    };
  }, []);
  return mode;
}

/** Official Star Force Honor insignia — operator upload, bundled file, or drawn fallback. */
function HonorInsignia({ customUrl, className }: { customUrl: string | null; className: string }) {
  const url = customUrl ?? INSIGNIA_URL;
  if (url) {
    return (
      <img
        src={url}
        alt="Official Star Force Honor insignia"
        className={`${className} drop-shadow-[0_10px_28px_rgba(0,0,0,0.85)]`}
      />
    );
  }
  return (
    <svg viewBox="0 0 240 150" className={className} aria-label="Star Force insignia" role="img">
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
      <circle cx="120" cy="70" r="46" fill="none" stroke="url(#hof-ring)" strokeWidth="7" />
      <circle cx="120" cy="70" r="39" fill="none" stroke="#55617a" strokeWidth="1.2" />
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
      <circle cx="120" cy="70" r="33" fill="#10192b" stroke="#33405a" strokeWidth="1.4" />
      <ellipse cx="120" cy="70" rx="34" ry="13" fill="none" stroke="url(#hof-gold)" strokeWidth="1.5" transform="rotate(-18 120 70)" />
      <path d="M112 52 C88 26 48 20 14 34 C40 38 62 48 80 62 C92 70 104 72 114 66 Z" fill="url(#hof-steel)" stroke="#4c5a72" strokeWidth="1.1" />
      <path d="M128 52 C152 26 192 20 226 34 C200 38 178 48 160 62 C148 70 136 72 126 66 Z" fill="url(#hof-steel)" stroke="#4c5a72" strokeWidth="1.1" />
      <path d="M112 66 C92 54 64 52 38 62 C60 66 78 74 92 84 C100 90 110 90 116 84 Z" fill="url(#hof-steel2)" stroke="#4c5a72" strokeWidth="1" />
      <path d="M128 66 C148 54 176 52 202 62 C180 66 162 74 148 84 C140 90 130 90 124 84 Z" fill="url(#hof-steel2)" stroke="#4c5a72" strokeWidth="1" />
      <path d="M120 30 L126.5 51 L148.5 51.5 L131 64.5 L137.5 85.5 L120 73 L102.5 85.5 L109 64.5 L91.5 51.5 L113.5 51 Z" fill="url(#hof-gold)" stroke="#6d5313" strokeWidth="1.2" />
      <path d="M120 88 L124 100 L120 122 L116 100 Z" fill="url(#hof-steel)" stroke="#4c5a72" strokeWidth="0.9" />
      <path d="M74 112 C96 122 144 122 166 112 L166 128 C144 138 96 138 74 128 Z" fill="url(#hof-steel2)" stroke="#3f4b61" strokeWidth="1" />
      <text x="120" y="125" textAnchor="middle" fontSize="11.5" fontWeight="800" letterSpacing="1" fill="#0c1424">
        STARFORCE BASE 1198
      </text>
      <text x="120" y="143" textAnchor="middle" fontSize="8" fontWeight="600" letterSpacing="2.2" fill="#9fb0c8">
        AETERNAM FORTIS
      </text>
    </svg>
  );
}

/**
 * Engraved interceptor silhouette — default plate art until a real image is
 * attached (per fighter or per type in the operator console).
 */
function FighterMark() {
  return (
    <svg viewBox="0 0 120 52" className="h-full w-full" aria-hidden focusable="false">
      <defs>
        <linearGradient id="hof-fmk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d5313" />
          <stop offset="55%" stopColor="#4a3608" />
          <stop offset="100%" stopColor="#2a1c05" />
        </linearGradient>
      </defs>
      <path
        d="M8 27 L28 23 L74 21.5 L104 24.5 L110 26 L104 27.5 L74 30.5 L28 31 Z"
        fill="url(#hof-fmk)"
        stroke="#241703"
        strokeWidth="0.8"
      />
      <path d="M30 24 L44 22.5 L56 23.5 L56 26.5 L32 27 Z" fill="#1c1204" opacity="0.85" />
      <path d="M52 23 L86 8 L98 10 L70 24 Z" fill="url(#hof-fmk)" stroke="#241703" strokeWidth="0.7" />
      <path d="M52 29 L86 44 L98 42 L70 28 Z" fill="url(#hof-fmk)" stroke="#241703" strokeWidth="0.7" />
      <path d="M92 25 L102 15 L106 16 L99 25.5 Z" fill="url(#hof-fmk)" stroke="#241703" strokeWidth="0.6" />
      <path d="M92 27 L102 37 L106 36 L99 26.5 Z" fill="url(#hof-fmk)" stroke="#241703" strokeWidth="0.6" />
      <circle cx="9.5" cy="27" r="2.2" fill="#7a540c" opacity="0.9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Mode 1 — BLANK TEMPLATE OVERLAY: live records rendered onto the 21 slots.
// ---------------------------------------------------------------------------

function TemplateOverlay({
  rows,
  images,
  onOpen,
  query,
  onQuery,
  total,
}: {
  rows: Plaque[];
  images: Record<string, string | null> | undefined;
  onOpen: (p: Plaque) => void;
  query: string;
  onQuery: (v: string) => void;
  total: number;
}) {
  const ordered = useMemo(
    () => [...rows].sort((a, b) => a.hullNumber.localeCompare(b.hullNumber)),
    [rows],
  );
  // The artwork carries the first 21 awards; every award beyond that
  // continues below in matching textured plates — the wall grows forever.
  const onImage = ordered.slice(0, COLS * ROWS);
  const overflow = ordered.slice(COLS * ROWS);
  // Position each slot from the calibration constants.
  const slots = useMemo(() => {
    const w = (WALL_AREA.right - WALL_AREA.left) / COLS;
    const h = (WALL_AREA.bottom - WALL_AREA.top) / ROWS;
    return Array.from({ length: COLS * ROWS }, (_, i) => {
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      return {
        left: WALL_AREA.left + c * w + CELL_INSET / 2,
        top: WALL_AREA.top + r * h + CELL_INSET / 2,
        width: w - CELL_INSET,
        height: h - CELL_INSET,
      };
    });
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-[1500px]" style={{ containerType: "inline-size" }}>
      <img
        src={BLANK_SRC}
        alt="1st Inter-Dimensional Fleet Fighter Honor Wall"
        className="block w-full rounded-sm shadow-[0_30px_80px_rgba(0,0,0,0.8)]"
      />
      {/* live ledger controls — kept below the artwork so it stays untouched */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9b678]">
          {total} fighter award{total === 1 ? "" : "s"} engraved · live ledger
        </p>
        <label className="flex items-center gap-2">
          <span className="sr-only">Search the honor wall</span>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search pilot, callsign, hull…"
            className="w-52 rounded border border-[rgba(168,135,58,0.4)] bg-[rgba(7,12,24,0.85)] px-3 py-1.5 text-xs text-[#e8e2c8] placeholder:text-[#8b8464] focus:border-[#c9a13e] focus:outline-none sm:w-64"
          />
        </label>
      </div>
      {overflow.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-center text-[10px] font-bold uppercase tracking-[0.3em] text-[#c9b678]">
            ✦ Continuation wing ✦
          </p>
          <ul className="grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
            {overflow.map((p) => (
              <HonorPlate
                key={p._id}
                plaque={p}
                image={images?.[p._id] ?? null}
                onOpen={() => onOpen(p)}
              />
            ))}
          </ul>
        </div>
      )}
      {slots.map((s, i) => {
        const p = ordered[i];
        if (!p) return null;
        const img = images?.[p._id] ?? null;
        const abbr = rankAbbr(p.memberRank);
        return (
          <button
            key={p._id}
            type="button"
            onClick={() => onOpen(p)}
            className="group absolute flex cursor-pointer flex-col items-center justify-end overflow-hidden rounded-[2px] text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f3dc94]"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.width}%`,
              height: `${s.height}%`,
            }}
            aria-label={`${abbr ?? ""} ${p.memberName} — ${p.designation}, hull ${p.hullNumber}`}
          >
            {/* fighter art — upper 55% of the plate */}
            <span className="absolute inset-x-[6%] top-[2%] h-[52%]">
              {img ? (
                <img
                  src={img}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-contain mix-blend-multiply"
                />
              ) : (
                <FighterMark />
              )}
            </span>
            {/* engraved text — lower portion, scales with the image width */}
            <span
              className="block w-full px-[4%] font-extrabold uppercase leading-[1.25] text-[#16203a]"
              style={{ fontSize: "clamp(7px, 1.35cqw, 15px)" }}
            >
              {abbr ? `${abbr} ` : ""}
              {p.memberName}
            </span>
            <span
              className="block w-full px-[4%] font-semibold uppercase leading-[1.2] text-[#22304f]"
              style={{ fontSize: "clamp(6px, 1.05cqw, 12px)" }}
            >
              Fighter
            </span>
            <span
              className="block w-full truncate px-[4%] font-bold uppercase leading-[1.25] text-[#16203a]"
              style={{ fontSize: "clamp(6.5px, 1.2cqw, 13px)" }}
            >
              {p.designation}
            </span>
            <span
              className="block w-full px-[4%] font-mono leading-[1.4] text-[#1c2740]"
              style={{ fontSize: "clamp(6px, 1.05cqw, 12px)" }}
            >
              HULL {p.hullNumber}
            </span>
            <span
              className="block leading-none text-[#1c2740]"
              style={{ fontSize: "clamp(7px, 1.2cqw, 13px)" }}
              aria-hidden
            >
              ★
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function HonorWall() {
  usePageMeta({
    title: "1st Inter-Dimensional Fleet — Fighter Honor Wall | Star Force Base 1198",
    description:
      "The official fighter honor wall of the 1st Inter-Dimensional Fleet. Every awarded StarCraft fighter: the pilot, their callsign, the designation, and the permanent hull number.",
  });

  const rows = useQuery(api.starfighters.honorWall) as Plaque[] | undefined;
  const images = useQuery(api.starfighters.getWallImages, {}) as
    | Record<string, string | null>
    | undefined;
  const insignia = useQuery(api.starfighters.getWallInsignia, {});
  const templateMode = useTemplateMode();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Plaque | null>(null);

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    const list = q
      ? rows.filter((p) =>
          [p.memberName, p.callsign, p.designation, p.hullNumber, p.memberRank ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : rows;
    return [...list].sort((a, b) => a.hullNumber.localeCompare(b.hullNumber));
  }, [rows, query]);

  // ---- Template modes: the operator's artwork IS the page -----------------
  if (templateMode === "blank" || templateMode === "reference") {
    return (
      <SiteShell>
        <div
          className="min-h-screen px-2 py-6 sm:px-5 sm:py-9"
          style={{
            background:
              "radial-gradient(1400px 520px at 50% -160px, rgba(44,72,122,0.4), transparent 70%), linear-gradient(180deg, #0a0a0c 0%, #10131c 40%, #08090d 100%)",
          }}
        >
          <div className="mx-auto max-w-[1500px]">
            {templateMode === "blank" ? (
              rows === undefined ? (
                <div className="animate-pulse rounded-sm bg-[rgba(201,161,62,0.08)]" style={{ aspectRatio: "1456 / 944" }} />
              ) : (
                <TemplateOverlay
                  rows={visible}
                  images={images}
                  onOpen={(p) => setSelected(p)}
                  query={query}
                  onQuery={setQuery}
                  total={rows.length}
                />
              )
            ) : (
              /* EXACT COPY — the finished reference shown as-is */
              <img
                src={REFERENCE_SRC}
                alt="1st Inter-Dimensional Fleet Fighter Honor Wall"
                className="block w-full rounded-sm shadow-[0_30px_80px_rgba(0,0,0,0.8)]"
              />
            )}
          </div>
        </div>
        <PlaqueDialog selected={selected} onClose={() => setSelected(null)} />
      </SiteShell>
    );
  }

  // ---- Built display case (default when no template file is present) ------
  return (
    <SiteShell>
      <div
        className="min-h-screen"
        style={{
          background:
            "radial-gradient(1400px 520px at 50% -160px, rgba(44,72,122,0.55), transparent 70%), linear-gradient(180deg, #0a0a0c 0%, #10131c 40%, #08090d 100%)",
        }}
      >
        <div className="px-2 py-6 sm:px-5 sm:py-9">
          <div className="mx-auto max-w-[1500px]">
            {/* -- Heavy outer gold frame -- */}
            <div
              className="relative rounded-[10px] p-2.5 sm:p-3.5 shadow-[0_30px_80px_rgba(0,0,0,0.85)]"
              style={{
                background:
                  "linear-gradient(135deg,#f6e3a6 0%,#d9b45a 14%,#8a6a20 38%,#5e4310 52%,#a8873a 68%,#e8cf8a 86%,#b98d2c 100%)",
              }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[10px]"
                style={{
                  background:
                    "linear-gradient(180deg,rgba(255,255,255,0.35),transparent 18%,transparent 82%,rgba(60,40,5,0.5))",
                  mixBlendMode: "overlay",
                }}
              />
              <div className="rounded-[6px] p-[3px]" style={{ background: "linear-gradient(180deg,#8a6a20,#e8cf8a 30%,#8a6a20 70%,#5e4310)" }}>
                <div
                  className="relative overflow-hidden rounded-[4px]"
                  style={{
                    background:
                      "radial-gradient(120% 90% at 50% 0%, #1d3054 0%, #14233f 38%, #0c1628 72%, #070d1a 100%)",
                  }}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.35]"
                    style={{
                      backgroundImage:
                        "radial-gradient(1px 1px at 18% 30%, rgba(210,225,255,0.8), transparent 55%), radial-gradient(1px 1px at 62% 18%, rgba(210,225,255,0.6), transparent 55%), radial-gradient(1.5px 1.5px at 82% 42%, rgba(190,210,245,0.7), transparent 55%), radial-gradient(1px 1px at 38% 55%, rgba(210,225,255,0.5), transparent 55%), radial-gradient(1px 1px at 72% 70%, rgba(210,225,255,0.45), transparent 55%)",
                    }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-40"
                    style={{
                      background:
                        "conic-gradient(from 170deg at 18% -12%, transparent 65deg, rgba(214,230,255,0.14) 82deg, transparent 100deg), conic-gradient(from 190deg at 50% -12%, transparent 62deg, rgba(214,230,255,0.18) 82deg, transparent 102deg), conic-gradient(from 210deg at 82% -12%, transparent 65deg, rgba(214,230,255,0.14) 82deg, transparent 100deg)",
                    }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ boxShadow: "inset 0 0 90px 30px rgba(3,7,15,0.8)" }}
                  />

                  {/* ======================= BANNER PANEL ======================= */}
                  <div className="px-3 pt-4 sm:px-6 sm:pt-6">
                    <div className="relative">
                      <div
                        className="p-[3px]"
                        style={{
                          background:
                            "linear-gradient(120deg,#f6e3a6,#8a6a20 30%,#5e4310 50%,#e8cf8a 72%,#8a6a20)",
                          clipPath:
                            "polygon(2.5% 0%, 97.5% 0%, 100% 22%, 100% 78%, 97.5% 100%, 2.5% 100%, 0% 78%, 0% 22%)",
                        }}
                      >
                        <div
                          className="relative px-5 py-6 sm:px-10 sm:py-8"
                          style={{
                            background:
                              "radial-gradient(120% 130% at 50% 0%, #24406e 0%, #16294a 45%, #0d1a30 100%)",
                            clipPath:
                              "polygon(2.4% 0%, 97.6% 0%, 100% 22%, 100% 78%, 97.6% 100%, 2.4% 100%, 0% 78%, 0% 22%)",
                          }}
                        >
                          <div
                            aria-hidden
                            className="pointer-events-none absolute inset-0"
                            style={{
                              background:
                                "linear-gradient(104deg, transparent 30%, rgba(255,255,255,0.09) 43%, transparent 56%)",
                            }}
                          />
                          <div className="grid gap-6 lg:grid-cols-[230px_1fr_230px] lg:gap-4">
                            <div className="hidden lg:flex flex-col items-center justify-center text-center">
                              <span aria-hidden className="mb-2 text-[#d9b45a]">✦</span>
                              <p className="text-[11px] font-semibold uppercase leading-5 tracking-[0.18em] text-[#e8d9a8] [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
                                The stars
                                <br />
                                are not the limit
                                <br />
                                they are
                                <br />
                                the beginning.
                              </p>
                              <span aria-hidden className="mt-2 text-[#d9b45a]">✦</span>
                            </div>

                            <div className="flex flex-col items-center text-center">
                              <HonorInsignia customUrl={insignia?.url ?? null} className="h-24 w-auto sm:h-28 lg:h-36" />
                              <h1 className="mt-4 text-[24px] font-extrabold uppercase leading-tight tracking-[0.04em] sm:text-4xl lg:text-[42px]">
                                <span className="bg-[linear-gradient(180deg,#fffbe8_0%,#f7e7a9_38%,#e0bd5f_62%,#a57d1e_100%)] bg-clip-text text-transparent [filter:drop-shadow(0_2px_1px_rgba(0,0,0,0.9))_drop-shadow(0_0_18px_rgba(240,210,120,0.25))]">
                                  1st Inter-Dimensional Fleet
                                </span>
                              </h1>
                              <div className="mt-2.5 flex w-full max-w-lg items-center gap-3">
                                <span aria-hidden className="h-px flex-1 bg-[linear-gradient(90deg,transparent,#c9a13e)]" />
                                <span aria-hidden className="text-[10px] text-[#c9a13e]">★</span>
                                <h2 className="text-sm font-bold uppercase tracking-[0.42em] text-[#f0e3b2] [text-shadow:0_2px_6px_rgba(0,0,0,0.8)] sm:text-lg sm:tracking-[0.5em]">
                                  Fighter Honor Wall
                                </h2>
                                <span aria-hidden className="text-[10px] text-[#c9a13e]">★</span>
                                <span aria-hidden className="h-px flex-1 bg-[linear-gradient(270deg,transparent,#c9a13e)]" />
                              </div>
                              <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#cbb87e] lg:hidden">
                                “The stars are not the limit. They are the beginning.”
                              </p>
                            </div>

                            <div className="hidden lg:flex flex-col items-center justify-center text-center">
                              <HonorInsignia customUrl={insignia?.url ?? null} className="h-16 w-auto opacity-90" />
                              <p className="mt-2.5 text-base font-extrabold uppercase tracking-[0.28em] text-[#f0e3b2] [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]">
                                Star Force
                              </p>
                              <p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#c9b678]">
                                Protect ✦ Defend ✦ Explore
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ======================= THE PLAQUE WALL ======================= */}
                  <div className="px-3 pb-5 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#c9b678]">
                        {rows === undefined
                          ? "Consulting the honor ledger…"
                          : `${visible.length} fighter award${visible.length === 1 ? "" : "s"} on display`}
                      </p>
                      <label className="flex items-center gap-2">
                        <span className="sr-only">Search the honor wall</span>
                        <input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search pilot, callsign, hull…"
                          className="w-52 rounded border border-[rgba(168,135,58,0.4)] bg-[rgba(7,12,24,0.85)] px-3 py-1.5 text-xs text-[#e8e2c8] placeholder:text-[#8b8464] focus:border-[#c9a13e] focus:outline-none sm:w-64"
                        />
                      </label>
                    </div>

                    {rows === undefined ? (
                      <ul className="grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
                        {Array.from({ length: 14 }).map((_, i) => (
                          <li
                            key={i}
                            className="h-56 animate-pulse rounded-md bg-[rgba(201,161,62,0.1)]"
                          />
                        ))}
                      </ul>
                    ) : visible.length === 0 ? (
                      <div className="mx-auto max-w-xl rounded-md border border-[rgba(168,135,58,0.4)] bg-[rgba(7,13,26,0.9)] p-10 text-center">
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#e8d9a8]">
                          {query ? "No plaques match that search" : "The wall awaits its first engraving"}
                        </p>
                        {!query && (
                          <p className="mt-2 text-xs leading-5 text-[#9aa7bd]">
                            When a member earns their wings through contests and awards, their
                            fighter — callsign, designation, and permanent hull number — is
                            engraved here automatically.
                          </p>
                        )}
                      </div>
                    ) : (
                      <ul className="grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
                        {visible.map((p) => (
                          <HonorPlate
                            key={p._id}
                            plaque={p}
                            image={images?.[p._id] ?? null}
                            onOpen={() => setSelected(p)}
                          />
                        ))}
                      </ul>
                    )}

                    <footer className="mt-7 border-t border-[rgba(168,135,58,0.35)] pt-5 pb-1 text-center">
                      <p className="text-[11px] font-bold uppercase tracking-[0.34em] text-[#f0e3b2] [text-shadow:0_2px_6px_rgba(0,0,0,0.8)] sm:text-sm">
                        1st Inter-Dimensional Fleet <span className="mx-3 text-[#c9a13e]">★</span> Fighter Wing
                      </p>
                      <p className="mt-1.5 text-[10px] uppercase tracking-[0.18em] text-[#77839b]">
                        Protect • Defend • Explore
                      </p>
                    </footer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PlaqueDialog selected={selected} onClose={() => setSelected(null)} />
    </SiteShell>
  );
}

// ---------------------------------------------------------------------------
// Plaque detail dialog (shared by template overlay + built wall).
// ---------------------------------------------------------------------------

function PlaqueDialog({
  selected,
  onClose,
}: {
  selected: Plaque | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={selected !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-[#a8873a] bg-[#0b1526] text-[#e8e2c8]">
        {selected && (
          <>
            <DialogHeader>
              <DialogDescription className="text-[10px] uppercase tracking-[0.24em] text-[#c9b678]">
                Fighter award record
              </DialogDescription>
              <DialogTitle className="text-lg font-bold uppercase tracking-[0.06em] text-[#f3dc94]">
                {selected.callsign}
              </DialogTitle>
            </DialogHeader>
            <div
              className="rounded-md border border-[#8a6a20] p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
              style={{ backgroundImage: `url(${goldPlateUrl})`, backgroundSize: "cover" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#2a1c05]">
                {rankAbbr(selected.memberRank) ?? ""} {selected.memberName.toUpperCase()}
              </p>
              {selected.memberRank ? (
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#4a3608]">
                  {selected.memberRank}
                </p>
              ) : null}
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5b430f]">
                Fighter
              </p>
              <p className="text-[11px] font-bold uppercase text-[#2a1c05]">{selected.designation}</p>
              <p className="mt-1.5 font-mono text-[10px] tracking-[0.12em] text-[#3a2a08]">
                HULL {selected.hullNumber}
              </p>
              <p className="mt-1.5 text-[#7a540c]" aria-hidden>★</p>
            </div>
            <dl className="space-y-1.5 text-xs text-[#c4cbd8]">
              <div className="flex justify-between gap-3">
                <dt className="uppercase tracking-[0.14em] text-[#8fa0bd]">Awarded</dt>
                <dd>{new Date(selected.awardedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</dd>
              </div>
              {selected.shipClass ? (
                <div className="flex justify-between gap-3">
                  <dt className="uppercase tracking-[0.14em] text-[#8fa0bd]">Class</dt>
                  <dd>{selected.shipClass}</dd>
                </div>
              ) : null}
            </dl>
            {!selected.hullNumber.includes("-D") && (
              <Link
                to={`/u/${selected.memberId}`}
                className="uf-btn uf-btn--ghost w-full text-sm"
                onClick={onClose}
              >
                View pilot profile
              </Link>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Built award plate — real brushed-gold texture, beveled edge, engraved text.
// (Used when no template image is present in public/assets/.)
// ---------------------------------------------------------------------------

function HonorPlate({
  plaque: p,
  image,
  onOpen,
}: {
  plaque: Plaque;
  image: string | null;
  onOpen: () => void;
}) {
  const abbr = rankAbbr(p.memberRank);
  const name = p.memberName.toUpperCase();

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group relative block h-full w-full cursor-pointer rounded-[5px] p-[3px] text-center shadow-[0_8px_18px_rgba(0,0,0,0.55),0_2px_5px_rgba(0,0,0,0.5)] transition-transform duration-150 hover:-translate-y-1 hover:shadow-[0_14px_26px_rgba(0,0,0,0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f3dc94]"
        style={{
          background: "linear-gradient(150deg,#f6e3a6 0%,#c9a13e 30%,#7a540c 62%,#e8cf8a 100%)",
        }}
        aria-label={`${abbr ?? ""} ${name} — ${p.designation}, hull ${p.hullNumber}. View award details.`}
      >
        <span
          className="relative block h-full overflow-hidden rounded-[3px] px-2 pb-3 pt-2.5"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(255,244,200,0.55) 0%, rgba(255,255,255,0) 30%, rgba(90,60,10,0.28) 100%), url(${goldPlateUrl})`,
            backgroundSize: "100% 100%, cover",
            backgroundPosition: "center",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, rgba(105,75,15,0.25) 1px, rgba(105,75,15,0.25) 2px, rgba(255,255,255,0.2) 2px, rgba(255,255,255,0.2) 4px)",
            }}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-[14%] w-1/4 -skew-x-12 bg-gradient-to-b from-white/45 via-white/10 to-transparent"
          />
          {["left-1 top-1", "right-1 top-1", "left-1 bottom-1", "right-1 bottom-1"].map(
            (pos) => (
              <span
                key={pos}
                aria-hidden
                className={`absolute ${pos} h-1.5 w-1.5 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff7dd,#b98a25_70%,#5e4310)] shadow-[inset_0_0_2px_rgba(40,26,2,0.9)]`}
              />
            ),
          )}

          <span className="relative block">
            <span className="block h-[70px] w-full">
              {image ? (
                <img
                  src={image}
                  alt={`${p.designation} — awarded fighter`}
                  loading="lazy"
                  className="h-full w-full object-contain mix-blend-multiply"
                />
              ) : (
                <FighterMark />
              )}
            </span>

            <span className="mt-1.5 block truncate text-[11px] font-extrabold uppercase leading-tight text-[#241703] [text-shadow:0_1px_0_rgba(255,248,220,0.65)]">
              {abbr ? `${abbr} ` : ""}
              {name}
            </span>

            <span className="mt-0.5 block truncate text-[10px] font-bold uppercase leading-tight tracking-[0.08em] text-[#5e4310] [text-shadow:0_1px_0_rgba(255,248,220,0.55)]">
              “{p.callsign}”
            </span>

            <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.22em] text-[#4a3608]">
              Fighter
            </span>
            <span className="block truncate text-[11px] font-bold uppercase leading-tight text-[#241703] [text-shadow:0_1px_0_rgba(255,248,220,0.6)]">
              {p.designation}
            </span>

            <span className="mt-1 block font-mono text-[9.5px] tracking-[0.1em] text-[#3a2a08]">
              HULL {p.hullNumber}
            </span>

            <span className="mt-0.5 block text-[11px] leading-none text-[#5e4310]" aria-hidden>
              ★
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}
