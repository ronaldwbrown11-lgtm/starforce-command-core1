import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "react-router";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Crosshair, MapPin, Minus, Plus, RotateCcw, Sparkles, Star, Move, Rocket } from "lucide-react";
import milkyWayUrl from "@/assets/milky-way-map.jpg";

// Camera-dive animation — eases zoom/pan toward a target frame so clicking a
// sector visibly "zooms into" it before its focused chart opens.
function animateCamera(
  from: { cx: number; cy: number; z: number },
  to: { cx: number; cy: number; z: number },
  durationMs: number,
  onStep: (s: { cx: number; cy: number; z: number }) => void,
  onDone: () => void,
): () => void {
  const start = performance.now();
  let raf = 0;
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    const k = ease(t);
    onStep({
      cx: from.cx + (to.cx - from.cx) * k,
      cy: from.cy + (to.cy - from.cy) * k,
      z: from.z + (to.z - from.z) * k,
    });
    if (t < 1) raf = requestAnimationFrame(tick);
    else onDone();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

// Zoom limits — the deep 40× max exists so operators can zoom from the full
// galaxy down to a single sector cluster for charting and edits.
const MAP_MIN_ZOOM = 0.5;
const MAP_MAX_ZOOM = 40;

// Deterministic pseudo-random stars for the chart backdrop (no Math.random
// so the map is stable between renders).
function seeded(i: number) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Deterministic accent per index — same palette as the mini map widget.
const HUES = [
  { line: "rgba(0,229,255,0.55)", glow: "var(--uf-cyan)" },
  { line: "rgba(139,92,246,0.55)", glow: "var(--uf-violet)" },
  { line: "rgba(255,61,242,0.55)", glow: "var(--uf-magenta)" },
  { line: "rgba(230,168,23,0.55)", glow: "var(--uf-gold)" },
  { line: "rgba(45,255,136,0.55)", glow: "var(--uf-green)" },
  { line: "rgba(255,77,109,0.55)", glow: "var(--uf-red)" },
];

// Anti-clutter limits.
const DRAW_CAP = 60; // only the most recent N charted systems are drawn
const DEFAULT_SECTOR_R = 60; // sector region radius when the operator hasn't set one
const SECTOR_VISIT_RADIUS = 60; // chart units — clicking within this of a sector logs an exploration visit
const CLUSTER_R = 22; // viewBox units — systems closer than this group together

// ---------------------------------------------------------------------------
// Real-galaxy backdrop — NASA/JPL-Caltech/R. Hurt's face-on Milky Way map
// (public domain), cover-fitted into the chart's dynamic viewBox so the
// interactive layers stay registered over the real galactic disc. Sol is
// pinned to its true position on the Orion Spur (about 26,700 light-years
// from the core, between the Sagittarius and Perseus arms).
// ---------------------------------------------------------------------------

const MILKY_WAY = { w: 1920, h: 1920 };

/**
 * Sol's position in viewBox coordinates. The map is cover-fitted (scaled to
 * fully cover the viewBox, then centered) and rendered rotated 180° (operator
 * preference), so image-space fractions flip: fu' = 1 - fu, fv' = 1 - fv.
 * On Hurt's rendering Sol sits at roughly (0.50, 0.30) in image space —
 * on the Orion Spur — which lands at (0.50, 0.70) after the flip.
 */
const SOL_IMG = { fu: 0.5, fv: 0.3 };

function solPointIn(vbX: number, vbY: number, vbW: number, vbH: number) {
  const scale = Math.max(vbW / MILKY_WAY.w, vbH / MILKY_WAY.h);
  const drawW = MILKY_WAY.w * scale;
  const drawH = MILKY_WAY.h * scale;
  const offX = vbX + (vbW - drawW) / 2;
  const offY = vbY + (vbH - drawH) / 2;
  return {
    x: offX + (1 - SOL_IMG.fu) * drawW,
    y: offY + (1 - SOL_IMG.fv) * drawH,
  };
}

/** Points string for a 5-pointed star (capital insignia). */
function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Points string for an upward triangle (boundary vertex marker). */
function trianglePoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
    pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`);
  }
  return pts.join(" ");
}

type Discovery = {
  _id: string;
  title: string;
  description: string;
  x: number;
  y: number;
  sector: string | null;
  faction: string | null;
  createdAt: number;
  voteCount: number;
  myVote: boolean;
  author: { displayName: string; rank: string } | null;
};

type Cluster = { members: Discovery[]; cx: number; cy: number };

const LAYERS = [
  { key: "galaxy", label: "Galaxy underlay" },
  { key: "stars", label: "Starfield" },
  { key: "connections", label: "Transit lanes & gates" },
  { key: "sectors", label: "Canon sectors" },
  { key: "discoveries", label: "Member systems" },
] as const;

type LayerKey = (typeof LAYERS)[number]["key"];

// A canon sector row as the widget sees it (post kind-split queries).
type SectorRow = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  loreCount?: number;
  x: number;
  y: number;
  r?: number;
};

type SectorSystem = {
  key: string;
  id: string;
  title: string;
  kind: "canon" | "member";
  href?: string;
  x: number;
  y: number;
  description?: string;
  /** Real-catalog stars: light-years from Sol. */
  distLy?: number;
};

// ---------------------------------------------------------------------------
// SectorChart — focused overlay chart for a single sector. The sector's
// region becomes a compact fixed frame with its own zoom/pan; click empty
// space to propose a system pre-tagged to the sector. Operators add canon
// systems inline and can delete them.
// ---------------------------------------------------------------------------
function SectorChart({
  sector,
  systems,
  height,
  onBack,
  onPropose,
  canSeed,
  onSeed,
  seeding = false,
  seedResult = null,
  focusName = null,
}: {
  sector: SectorRow;
  systems: SectorSystem[];
  height: number;
  onBack: () => void;
  onPropose: (x: number, y: number) => void;
  canSeed?: boolean;
  onSeed?: () => void;
  /** True while an operator-initiated seed request is in flight. */
  seeding?: boolean;
  /** Last seed result summary — null when no seed has run this session. */
  seedResult?: { added: number; skipped: number } | null;
  /** Optional system name to center the camera on when the chart opens. */
  focusName?: string | null;
}) {
  const { isAuthenticated, user } = useAuth();
  const addSystem = useMutation(api.sectorMap.addSystem);
  const removeSystem = useMutation(api.sectorMap.deleteSystem);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const isOperator = !!user?.opRole || user?.role === "admin";

  // Sector-region frame — padded so the region + labels fit comfortably.
  const frame = useMemo(() => {
    const r = Math.max(90, sector.r ?? DEFAULT_SECTOR_R) * 1.45;
    return { vbX: sector.x - r, vbY: sector.y - r, vbW: r * 2, vbH: r * 2 };
  }, [sector]);

  // Content-driven camera — frames the chart's ACTUAL systems rather than a
  // fixed ring-sized window, so a seeded catalog spreads across the view at
  // true relative bearings instead of clumping at dead center. With focusName,
  // the camera centers on that system and sizes itself to its nearest
  // neighbours: diving into 47 Ursae Majoris shows ITS neighbourhood spread
  // out, not the same wide frame re-centered.
  const cam = useMemo(() => {
    const focus = focusName
      ? systems.find((s) => s.title.toLowerCase() === focusName.toLowerCase())
      : undefined;
    if (systems.length === 0) return frame;
    const pad = Math.max(24, frame.vbW * 0.1);
    const xs = systems.map((s) => s.x);
    const ys = systems.map((s) => s.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const contentSpan = Math.max(maxX - minX, maxY - minY, 26) + pad * 2;
    if (focus) {
      const near = systems
        .filter((s) => s.key !== focus.key)
        .map((s) => Math.hypot(s.x - focus.x, s.y - focus.y))
        .sort((a, b) => a - b);
      const third = near[Math.min(2, near.length - 1)];
      const span = Math.max(Math.min((third ?? frame.vbW * 0.5) * 4.5, contentSpan), 30);
      return { vbX: focus.x - span / 2, vbY: focus.y - span / 2, vbW: span, vbH: span };
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const span = Math.max(contentSpan, frame.vbW * 0.3);
    return { vbX: cx - span / 2, vbY: cy - span / 2, vbW: span, vbH: span };
  }, [systems, frame, focusName]);

  const localToBase = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return {
      x: (p.x - cam.vbX - pan.x) / zoom + cam.vbX,
      y: (p.y - cam.vbY - pan.y) / zoom + cam.vbY,
    };
  };

  const zoomTo = (next: number) => {
    const clamped = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, next));
    if (clamped === zoom) return;
    const cx = cam.vbX + cam.vbW / 2;
    const cy = cam.vbY + cam.vbH / 2;
    setPan({
      x: cx - cam.vbX - (cx - cam.vbX) * clamped,
      y: cy - cam.vbY - (cy - cam.vbY) * clamped,
    });
    setZoom(clamped);
  };

  const onDragStart = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging || !dragRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
    const rect = svg.getBoundingClientRect();
    const vbScale = frame.vbW / rect.width / zoom;
    setPan((p) => ({ x: p.x + dx * vbScale, y: p.y + dy * vbScale }));
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onDragEnd = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const localStars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        x: cam.vbX + seeded(i) * cam.vbW,
        y: cam.vbY + seeded(i * 2 + 1) * cam.vbH,
        r: 0.5 + seeded(i * 3 + 2) * 1.1,
        o: 0.12 + seeded(i * 5 + 3) * 0.4,
      })),
    [cam],
  );

  const localUI = Math.max(1, Math.min(3, (cam.vbW / 200) * zoom));

  // De-collided label slots — catalog stars can sit fractions of a unit
  // apart (Proxima vs Alpha Centauri), so fixed label offsets overlap into
  // an unreadable smudge. Each system takes the first free slot around its
  // star: below, above, right, left, then one row further out.
  const labelSlots = useMemo(() => {
    const ui = localUI;
    const est = (t: string) => Math.max(44, t.length * 5.4 * ui);
    type Slot = { x: number; y: number; anchor: "start" | "middle" | "end" };
    type Box = { x: number; y: number; w: number; h: number };
    const placed: Box[] = [];
    const out = new Map<string, Slot>();
    const sorted = [...systems].sort((a, b) => a.x - b.x);
    for (const s of sorted) {
      const w = est(s.title);
      const h = 11 * ui;
      const cands: { slot: Slot; box: Box }[] = [
        { slot: { x: s.x, y: s.y + 17 * ui, anchor: "middle" }, box: { x: s.x - w / 2, y: s.y + 17 * ui - h + 2, w, h } },
        { slot: { x: s.x, y: s.y - 12 * ui, anchor: "middle" }, box: { x: s.x - w / 2, y: s.y - 12 * ui - h + 2, w, h } },
        { slot: { x: s.x + 12 * ui, y: s.y + 3 * ui, anchor: "start" }, box: { x: s.x + 12 * ui, y: s.y + 3 * ui - h + 2, w, h } },
        { slot: { x: s.x - 12 * ui, y: s.y + 3 * ui, anchor: "end" }, box: { x: s.x - 12 * ui - w, y: s.y + 3 * ui - h + 2, w, h } },
        { slot: { x: s.x, y: s.y + 29 * ui, anchor: "middle" }, box: { x: s.x - w / 2, y: s.y + 29 * ui - h + 2, w, h } },
        { slot: { x: s.x, y: s.y - 24 * ui, anchor: "middle" }, box: { x: s.x - w / 2, y: s.y - 24 * ui - h + 2, w, h } },
      ];
      let chosen = cands[0];
      for (const c of cands) {
        const hit = placed.some(
          (p) =>
            p.x < c.box.x + c.box.w + 2 &&
            c.box.x < p.x + p.w + 2 &&
            p.y < c.box.y + c.box.h &&
            c.box.y < p.y + p.h,
        );
        if (!hit) {
          chosen = c;
          break;
        }
      }
      placed.push(chosen.box);
      out.set(s.key, chosen.slot);
    }
    return out;
  }, [systems, localUI]);

  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{
        background:
          "radial-gradient(closest-side at 50% 50%, rgba(0,229,255,0.1), transparent 70%), var(--uf-navy)",
        border: "1px solid rgba(0,229,255,0.35)",
        height,
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`${cam.vbX + pan.x} ${cam.vbY + pan.y} ${cam.vbW / zoom} ${cam.vbH / zoom}`}
        preserveAspectRatio="xMidYMid meet"
        className={`w-full h-full ${dragging ? "cursor-grabbing" : "cursor-crosshair"}`}
        role="img"
        aria-label={`Sector chart for ${sector.name}. Click empty space to propose a system in this sector.`}
        style={{ touchAction: "pan-y" }}
        onPointerDown={onDragStart}
        onPointerMove={onPointerMove}
        onPointerUp={onDragEnd}
        onPointerLeave={onDragEnd}
        onDoubleClick={() => {
          setZoom(1);
          setPan({ x: 0, y: 0 });
        }}
        onClick={(e) => {
          if (dragMoved.current) {
            dragMoved.current = false;
            return;
          }
          const p = localToBase(e);
          if (p) onPropose(p.x, p.y);
        }}
      >
        <title>{`${sector.name} — sector chart`}</title>
        {localStars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#bfe9ff" opacity={s.o} />
        ))}

        {/* Sector boundary + wash */}
        <circle
          cx={sector.x}
          cy={sector.y}
          r={sector.r ?? DEFAULT_SECTOR_R}
          fill="rgba(0,229,255,0.05)"
          stroke="rgba(0,229,255,0.5)"
          strokeWidth={1.2 * localUI}
          strokeDasharray={`${4 * localUI} ${5 * localUI}`}
        />
        <text
          x={sector.x}
          y={sector.y - (sector.r ?? DEFAULT_SECTOR_R) - 8 * localUI}
          fontSize={12 * localUI}
          fill="var(--uf-cyan)"
          textAnchor="middle"
          fontWeight={600}
          letterSpacing={2 * localUI}
        >
          {sector.name.toUpperCase()}
        </text>

        {/* Canon + member systems */}
        {systems.map((sys) => {
          const hovered = hoverKey === sys.key;
          const color = sys.kind === "canon" ? "var(--uf-cyan)" : "var(--uf-green)";
          const slot = labelSlots.get(sys.key) ?? { x: sys.x, y: sys.y + 17 * localUI, anchor: "middle" as const };
          return (
            <g
              key={sys.key}
              onMouseEnter={() => setHoverKey(sys.key)}
              onMouseLeave={() => setHoverKey(null)}
              className={sys.href ? "cursor-pointer" : "cursor-default"}
              onClick={(e) => e.stopPropagation()}
            >
              <title>{sys.description ? `${sys.title} — ${sys.description}` : sys.title}</title>
              {sys.href ? (
                <a href={sys.href} aria-label={`Open ${sys.title}`} onClick={(e) => e.stopPropagation()}>
                  <circle cx={sys.x} cy={sys.y} r={(hovered ? 8 : 6) * localUI} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.4 * localUI} />
                  <circle cx={sys.x} cy={sys.y} r={2.2 * localUI} fill={color} />
                </a>
              ) : (
                <>
                  <circle cx={sys.x} cy={sys.y} r={(hovered ? 8 : 6) * localUI} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.4 * localUI} />
                  <circle cx={sys.x} cy={sys.y} r={2.2 * localUI} fill={color} />
                </>
              )}
              {[
                { t: sys.title, size: 9.5, fill: "var(--uf-text)", weight: hovered ? 700 : 500, ls: 0 },
                ...(sys.kind === "canon" && sys.distLy != null
                  ? [
                      {
                        t: `${sys.distLy % 1 === 0 ? sys.distLy : sys.distLy.toFixed(2)} ly`,
                        size: 8,
                        fill: "var(--uf-muted)",
                        weight: 500,
                        ls: 0.6,
                      },
                    ]
                  : []),
                { t: sys.kind === "canon" ? "CANON SYSTEM" : "MEMBER CHART", size: 7, fill: color, weight: 500, ls: 1.2 },
              ].map((ln, li) => (
                <text
                  key={li}
                  x={slot.x}
                  y={slot.y + li * 10 * localUI}
                  fontSize={ln.size * localUI}
                  fill={ln.fill}
                  textAnchor={slot.anchor}
                  fontWeight={ln.weight}
                  letterSpacing={ln.ls * localUI}
                  stroke="#050816"
                  strokeWidth={2.2 * localUI}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  {ln.t}
                </text>
              ))}
        {isOperator && sys.kind === "canon" && (
                <g
                  role="button"
                  tabIndex={0}
                  aria-label={`Delete canon system ${sys.title}`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete canon system "${sys.title}"? This cannot be undone.`)) {
                      void removeSystem({ id: sys.id as never }).catch((err) =>
                        toast.error(err instanceof Error ? err.message : "Delete failed."),
                      );
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") e.preventDefault();
                  }}
                >
                  <circle cx={sys.x + 12 * localUI} cy={sys.y - 12 * localUI} r={5 * localUI} fill="rgba(255,77,109,0.15)" stroke="var(--uf-red)" strokeWidth={0.8 * localUI} />
                  <text x={sys.x + 12 * localUI} y={sys.y - 9.5 * localUI} fontSize={7 * localUI} fill="var(--uf-red)" textAnchor="middle">×</text>
                </g>
              )}
            </g>
          );
        })}

        {/* Operator add-system pad */}
        {isOperator && (
          <g
            role="button"
            tabIndex={0}
            aria-label="Add a canon system at the center of this sector"
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              void (async () => {
                try {
                  await addSystem({
                    name: `${sector.name} System`,
                    x: sector.x,
                    y: sector.y,
                    sectorSlug: sector.slug,
                  });
                  toast.success("Canon system added — rename it in the console if needed.");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't add the system.");
                }
              })();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.preventDefault();
            }}
          >
            <title>Add a canon system at this sector's center</title>
            <circle
              cx={sector.x}
              cy={sector.y}
              r={13 * localUI}
              fill="rgba(0,229,255,0.1)"
              stroke="rgba(0,229,255,0.55)"
              strokeWidth={0.9 * localUI}
              strokeDasharray={`${2.5 * localUI} ${3 * localUI}`}
            />
            <text x={sector.x} y={sector.y + 3.5 * localUI} fontSize={11 * localUI} fill="var(--uf-cyan)" textAnchor="middle" fontWeight={700}>
              +
            </text>
          </g>
        )}
      </svg>

      {/* Controls */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-[rgba(0,229,255,0.45)] bg-[rgba(5,8,22,0.9)] px-3 py-1.5 text-xs text-uf-cyan hover:bg-[rgba(0,229,255,0.12)] transition-colors cursor-pointer"
        >
          ← Galaxy
        </button>
        <span className="rounded-full border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.85)] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-uf-text">
          {sector.name}
        </span>
        {canSeed && onSeed && (
          <button
            type="button"
            onClick={onSeed}
            disabled={seeding}
            className="rounded-full border border-[rgba(230,168,23,0.5)] bg-[rgba(5,8,22,0.9)] px-3 py-1.5 text-xs text-uf-gold hover:bg-[rgba(230,168,23,0.12)] transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait"
          >
            <Rocket className={`h-3.5 w-3.5 ${seeding ? "animate-pulse" : ""}`} aria-hidden />
            {seeding ? "Seeding…" : "Seed local group"}
          </button>
        )}
        {seedResult && (
          <span
            role="status"
            className="text-[10px] uppercase tracking-[0.14em] text-uf-gold bg-[rgba(5,8,22,0.85)] border border-[rgba(230,168,23,0.4)] rounded-full px-2.5 py-1"
          >
            {seedResult.added > 0
              ? `+${seedResult.added} stars${seedResult.skipped ? ` · ${seedResult.skipped} already charted` : ""}`
              : "already fully charted"}
          </span>
        )}
        <span className="text-[10px] uppercase tracking-[0.16em] text-uf-muted bg-[rgba(5,8,22,0.7)] border border-[color:var(--uf-border)] rounded-full px-2.5 py-1">
          {isAuthenticated ? "Click empty space to chart a system here" : "Sign in to chart"}
        </span>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => zoomTo(zoom * 1.5)}
          aria-label="Zoom in"
          className="h-11 w-11 grid place-items-center rounded-full border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.9)] text-uf-text hover:border-[rgba(0,229,255,0.6)] hover:text-uf-cyan active:scale-95 disabled:opacity-40 transition-all"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => zoomTo(zoom / 1.5)}
          aria-label="Zoom out"
          className="h-11 w-11 grid place-items-center rounded-full border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.9)] text-uf-text hover:border-[rgba(0,229,255,0.6)] hover:text-uf-cyan active:scale-95 disabled:opacity-40 transition-all"
        >
          <Minus className="h-5 w-5" aria-hidden />
        </button>
        {zoom !== 1 && (
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="Reset sector chart zoom"
            className="h-11 w-11 grid place-items-center rounded-full border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.9)] text-uf-muted hover:text-uf-text hover:border-[rgba(0,229,255,0.6)] active:scale-95 transition-all"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

export function DiscoveryMap({ height = 520 }: { height?: number }) {
  const { isAuthenticated, user } = useAuth();
  const sectors = useQuery(api.content.sectors);
  const discoveries = useQuery(api.discoveries.listDiscoveries);
  const missions = useQuery(api.content.listMissions, {});
  const factions = useQuery(api.factions.listAll);
  const propose = useMutation(api.discoveries.proposeDiscovery);
  const vote = useMutation(api.discoveries.voteDiscovery);
  const moveSector = useMutation(api.sectorMap.moveSector);
  const seedLocalGroup = useMutation(api.atlasSeed.seedLocalGroup);
  // ------------------------------------------------------------------
  // Two-level methodology: the galaxy chart shows sectors as large
  // clickable regions. Clicking one opens the focused SectorChart overlay
  // — a local chart where canon + member systems live and can be added.
  // One coordinate space, no data migration; the overlay owns its own
  // camera so the verified galaxy zoom/pan stays untouched.
  // ------------------------------------------------------------------
  const [overlaySectorName, setOverlaySectorName] = useState<string | null>(null);
  const [pendingSectorName, setPendingSectorName] = useState<string | null>(null);
  // When a dive starts FROM a specific star (e.g. 47 Ursae Majoris), the
  // sector chart centers its camera on that system's neighbourhood.
  const [focusSystemName, setFocusSystemName] = useState<string | null>(null);
  // Camera dive: animates zoom/pan to frame the sector ("zoom to a selected
  // area"), then opens the focused chart on arrival. Both behaviors, one click.
  const enterSector = (name: string, focusName?: string | null) => {
    if (diveRef.current) return;
    const target = (sectors ?? []).find((s) => s.name === name);
    if (!target) return;
    setFocusSystemName(focusName ?? null);
    setPendingSectorName(name);
    diveRef.current = animateCamera(
      {
        cx: viewBox.vbX + (viewBox.vbW / 2 - pan.x) / zoom,
        cy: viewBox.vbY + (viewBox.vbH / 2 - pan.y) / zoom,
        z: zoom,
      },
      { cx: target.x, cy: target.y, z: 4 },
      700,
      (step) => {
        setZoom(step.z);
        setPan({
          x: target.x - viewBox.vbX - (target.x - viewBox.vbX) * step.z,
          y: target.y - viewBox.vbY - (target.y - viewBox.vbY) * step.z,
        });
      },
      () => {
        setOverlaySectorName(name);
        setPendingSectorName(null);
        handleSectorVisited(name);
      },
    );
  };
  // Immediate entry used by the sector chart's "← Galaxy" flow internals
  // (and by keyboard activation on the seed button path).
  const exitToGalaxy = () => {
    setOverlaySectorName(null);
    setFocusSystemName(null);
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const diveRef = useRef<(() => void) | null>(null);
  // Cancel any in-flight camera dive on unmount.
  useEffect(() => () => diveRef.current?.(), []);
  // Zoom/pan state — the base viewBox from sector data, plus a user transform
  // on top. Wheel zooms toward the cursor (0.5× to 8× of the base frame);
  // drag pans; double-click and the ✕ control reset. Click-to-propose still
  // works because it resolves coordinates through the live CTM.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const dragMoved = useRef(false);
  // Last pointer position (client coords) — lets button zooms anchor to
  // wherever the user is pointing, so "hover an area, tap +" dives there.
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposePos, setProposePos] = useState<{ x: number; y: number } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [detail, setDetail] = useState<Discovery | null>(null);
  const [clusterOpen, setClusterOpen] = useState<Cluster | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverSectorId, setHoverSectorId] = useState<string | null>(null);
  const [hoverGateId, setHoverGateId] = useState<string | null>(null);
  // Operator "Seed local group" — in-flight flag plus the last result so the
  // sector chart can show real added/skipped counts instead of a canned toast.
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ added: number; skipped: number } | null>(null);
  const isOperator = !!user?.opRole || user?.role === "admin";
  // Operator sector-drag state: the ref tracks the live drag (px/py pointer,
  // ox/oy origin, nx/ny next position); the state mirrors it for rendering.
  const dragSectorRef = useRef<{
    id: string;
    name: string;
    px: number;
    py: number;
    ox: number;
    oy: number;
    nx: number;
    ny: number;
    moved: boolean;
  } | null>(null);
  const [dragSectorPos, setDragSectorPos] = useState<{ id: string; x: number; y: number } | null>(null);
  // Set on drag release, consumed by the click that follows it — prevents a
  // drag from also registering as a "dive into sector" click.
  const sectorJustDragged = useRef(false);
  const onSectorDragStart = (e: React.PointerEvent, s: { _id: string; name: string; x: number; y: number }) => {
    if (!isOperator || e.button !== 0) return;
    e.stopPropagation();
    diveRef.current?.();
    diveRef.current = null;
    setPendingSectorName(null);
    dragSectorRef.current = { id: s._id, name: s.name, px: e.clientX, py: e.clientY, ox: s.x, oy: s.y, nx: s.x, ny: s.y, moved: false };
    setDragSectorPos({ id: s._id, x: s.x, y: s.y });
  };
  const commitSectorDrag = async () => {
    const d = dragSectorRef.current;
    dragSectorRef.current = null;
    setDragSectorPos(null);
    sectorJustDragged.current = !!(d && d.moved);
    if (!d || !d.moved) return;
    try {
      await moveSector({ id: d.id as never, x: d.nx, y: d.ny });
      toast.success(`${d.name} moved — its canon systems moved with it.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't move the sector.");
    }
  };
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    galaxy: true,
    stars: true,
    connections: true,
    sectors: true,
    discoveries: true,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [faction, setFaction] = useState("");
  const [missionId, setMissionId] = useState("");
  // Dialog mode: charting a system vs proposing a whole new sector.
  const [proposingSector, setProposingSector] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voting, setVoting] = useState(false);

  const activeMissions = useMemo(
    () => (missions ?? []).filter((m) => m.missionStatus === "active"),
    [missions],
  );

  // Point the pointer is over, in base-viewBox coordinates (zoom/pan applied).
  const pointerToBase = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return {
      x: (p.x - viewBox.vbX - pan.x) / zoom + viewBox.vbX,
      y: (p.y - viewBox.vbY - pan.y) / zoom + viewBox.vbY,
    };
  };

  const onDragStart = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY };
    dragMoved.current = false;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    // Operator sector dragging — grab a sector region and slide it (and its
    // canon systems, server-side) to its proper galaxy position.
    if (dragSectorRef.current) {
      const svg = svgRef.current;
      if (svg) {
        const rect = svg.getBoundingClientRect();
        const vbScale = (viewBox.vbW / rect.width) / zoom;
        const dx = (e.clientX - dragSectorRef.current.px) * vbScale;
        const dy = (e.clientY - dragSectorRef.current.py) * vbScale;
        if (Math.abs(dx) + Math.abs(dy) > 0) dragSectorRef.current.moved = true;
        dragSectorRef.current = {
          ...dragSectorRef.current,
          px: e.clientX,
          py: e.clientY,
          nx: dragSectorRef.current.ox + dx,
          ny: dragSectorRef.current.oy + dy,
        };
        setDragSectorPos({ id: dragSectorRef.current.id, x: dragSectorRef.current.nx, y: dragSectorRef.current.ny });
      }
      return;
    }
    if (!dragging || !dragRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
    const rect = svg.getBoundingClientRect();
    // Divide by zoom: at 4× zoom the visible frame is 4× smaller in base
    // units, so each screen pixel moves the chart 4× less in base space.
    const vbScale = (viewBox.vbW / rect.width) / zoom;
    setPan((p) => ({
      x: p.x + dx * vbScale,
      y: p.y + dy * vbScale,
    }));
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onDragEnd = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const loading = sectors === undefined || discoveries === undefined;

  const viewBox = useMemo(() => {
    if (!sectors || !sectors.length) return { vbX: -60, vbY: -60, vbW: 720, vbH: 440 };
    const xs = sectors.map((s) => s.x);
    const ys = sectors.map((s) => s.y);
    // Wide margin so the outer galaxy stays visible around charted space —
    // the sectors frame inside a much larger field of view instead of
    // filling the window edge-to-edge.
    const pad = 320;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      vbX: minX - pad,
      vbY: minY - pad,
      vbW: Math.max(1120, maxX - minX) + pad * 2,
      vbH: Math.max(760, maxY - minY) + pad * 2,
    };  }, [sectors]);

  // UI scale factor — the chart is drawn in viewBox units, so zooming out
  // (wide field of view) shrinks everything drawn. This compensates: labels,
  // nodes, gates, and tooltips scale with the field of view so they stay
  // readable at any zoom. Clamped to sane bounds.
  const UI = Math.max(1, Math.min(2.6, viewBox.vbW / 800));

  // ------------------------------------------------------------------
  // Scene datasets
  // ------------------------------------------------------------------
  // The sector whose local chart is active, resolved by name.
  // The sector whose focused chart is open (null = galaxy view).
  const activeSector = useMemo(
    () => (overlaySectorName ? (sectors ?? []).find((s) => s.name === overlaySectorName) ?? null : null),
    [overlaySectorName, sectors],
  );

  // Canon star systems (sectorMap kind="system" rows) for sector views.
  const systemRows = useQuery(api.content.sectorSystems);

  // Systems drawn in the sector scene: canon systems linked to the sector
  // plus member-charted systems tagged to it.
  const sectorSystems = useMemo(() => {
    const sec = activeSector;
    if (!sec) return [];
    const canon = (systemRows ?? [])
      .filter((s) => s.sectorSlug === sec.slug)
      .map((s) => ({
        key: `canon:${s.slug}`,
        id: s._id as string,
        title: s.name,
        kind: "canon" as const,
        href: undefined,
        x: s.x,
        y: s.y,
        description: s.description ?? undefined,
        distLy: s.distLy,
      }));
    const member = (discoveries ?? [])
      .filter((d) => d.sector === sec.name)
      .map((d) => ({
        key: `member:${d._id}`,
        id: d._id as string,
        title: d.title,
        kind: "member" as const,
        href: undefined,
        x: d.x,
        y: d.y,
        description: d.description || undefined,
      }));
    return [...canon, ...member];
  }, [activeSector, systemRows, discoveries]);

  // ------------------------------------------------------------------
  // Auto-load the real local group the first time a Sol-sector chart
  // opens — every visitor gets the canonical stellar neighbourhood
  // (Sol, Centauri, Sirius, 47 Ursae Majoris, …) with no operator step.
  // Idempotent server-side; we attempt once per sector per session and
  // skip when the sector already carries canon systems.
  // ------------------------------------------------------------------
  const autoSeedTried = useRef<Set<string>>(new Set());
  useEffect(() => {
    const sec = activeSector;
    if (!sec || systemRows === undefined) return;
    if (!/^sol/i.test(sec.slug) && !/^sol/i.test(sec.name)) return;
    if (systemRows.some((s) => s.sectorSlug === sec.slug)) return;
    if (autoSeedTried.current.has(sec.slug)) return;
    autoSeedTried.current.add(sec.slug);
    void seedLocalGroup({ sectorSlug: sec.slug, includeSol: true, includeUma: true })
      .then((res) => {
        if (res.added > 0) {
          toast.success(
            `Sol sector charted — ${res.added} catalog stars from the real local group.`,
          );
        }
      })
      .catch(() => {
        // Only the Sol sector is public-seedable; other rejections
        // (clearance, unknown sector) stay silent — operators can seed
        // manually from the chart or the console.
      });
  }, [activeSector, systemRows, seedLocalGroup]);





  // Wheel zoom — attached as a native non-passive listener in the effect
  // below. React's onWheel prop registers passively at the document root,
  // so its preventDefault() is silently ignored and the page scrolls
  // instead of the chart zooming — the bug that left zoom dead on the
  // public Star Atlas page while the console happened to work.
  const applyWheelZoom = useCallback(
    (e: WheelEvent) => {
      // Only pinch-zoom (Ctrl+wheel — what trackpad/touchpad pinch fires)
      // zooms the chart. Plain two-finger scroll must NEVER be hijacked:
      // without this guard the page becomes unscrollable over the map.
      if (!e.ctrlKey) return;
      e.preventDefault();
      const p = pointerToBase(e);
      if (!p) return;
      const factor = e.deltaY < 0 ? 1 / 1.25 : 1.25;
      const next = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, zoom * factor));
      if (next === zoom) return;
      // Keep the point under the cursor fixed while zooming.
      const cx = viewBox.vbX + (p.x - viewBox.vbX) * zoom + pan.x;
      const cy = viewBox.vbY + (p.y - viewBox.vbY) * zoom + pan.y;
      setPan({
        x: cx - viewBox.vbX - (p.x - viewBox.vbX) * next,
        y: cy - viewBox.vbY - (p.y - viewBox.vbY) * next,
      });
      setZoom(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoom, pan.x, pan.y, viewBox.vbX, viewBox.vbY, viewBox.vbW, viewBox.vbH],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    svg.addEventListener("wheel", applyWheelZoom, { passive: false });
    return () => svg.removeEventListener("wheel", applyWheelZoom);
  }, [applyWheelZoom]);

  // Button zoom — anchored to the pointer when it's over the chart (hover
  // an area, tap +, dive straight in), frame center otherwise. Always
  // visible, so zooming works with a touchpad, touchscreen, or no gesture.
  const zoomTo = (next: number) => {
    const clamped = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, next));
    if (clamped === zoom) return;
    const svg = svgRef.current;
    const lp = lastPointerRef.current;
    let ax: number, ay: number; // anchor point, base-viewBox coords
    if (svg && lp) {
      const rect = svg.getBoundingClientRect();
      const inside =
        lp.x >= rect.left && lp.x <= rect.right && lp.y >= rect.top && lp.y <= rect.bottom;
      const p = inside ? pointerToBase({ clientX: lp.x, clientY: lp.y }) : null;
      if (p) {
        ax = p.x;
        ay = p.y;
      } else {
        ax = viewBox.vbX + viewBox.vbW / 2;
        ay = viewBox.vbY + viewBox.vbH / 2;
      }
    } else {
      ax = viewBox.vbX + viewBox.vbW / 2;
      ay = viewBox.vbY + viewBox.vbH / 2;
    }
    // Keep the anchor point fixed under the transform, like wheel zoom.
    setPan({
      x: ax - viewBox.vbX - (ax - viewBox.vbX) * clamped,
      y: ay - viewBox.vbY - (ay - viewBox.vbY) * clamped,
    });
    setZoom(clamped);
  };
  const zoomBy = (f: number) => zoomTo(zoom * f);

  // Real-galaxy backdrop mapping — recomputed only when the viewBox reframes.
  const galaxy = useMemo(
    () => {
      const scale = Math.max(viewBox.vbW / MILKY_WAY.w, viewBox.vbH / MILKY_WAY.h);
      return {
        rect: {
          x: viewBox.vbX + (viewBox.vbW - MILKY_WAY.w * scale) / 2,
          y: viewBox.vbY + (viewBox.vbH - MILKY_WAY.h * scale) / 2,
          w: MILKY_WAY.w * scale,
          h: MILKY_WAY.h * scale,
        },
        sol: solPointIn(viewBox.vbX, viewBox.vbY, viewBox.vbW, viewBox.vbH),
      };
    },
    [viewBox.vbX, viewBox.vbY, viewBox.vbW, viewBox.vbH],
  );

  // 47 Ursae Majoris — real Sun-like star ~46 ly from Sol with the famous
  // planetary system (and the fleet's Alliance Capital in canon). 46 ly is
  // sub-pixel at galactic scale, so the marker is stylized just off the Sol
  // pin rather than astronomically projected.
  const uma47 = { x: galaxy.sol.x + 16, y: galaxy.sol.y - 20 };

  // Solar neighborhood — the closest real systems to Earth, rendered as a
  // stylized cluster around the Sol pin (true distances are sub-pixel at
  // galactic scale). Offsets are fanned to keep labels legible.
  const localSystems = [
    { name: "Proxima Centauri", dist: "4.2 ly", dx: -14, dy: 18, ax: 2, ay: 13, anchor: "start" },
    { name: "Alpha Centauri", dist: "4.4 ly", dx: -34, dy: 30, ax: 2, ay: 13, anchor: "start" },
    { name: "Barnard's Star", dist: "6.0 ly", dx: 2, dy: 44, ax: 2, ay: 13, anchor: "start" },
    { name: "Wolf 359", dist: "7.9 ly", dx: -52, dy: -2, ax: -5, ay: 3, anchor: "end" },
    { name: "Lalande 21185", dist: "8.3 ly", dx: -44, dy: 52, ax: 2, ay: 13, anchor: "start" },
    { name: "Sirius", dist: "8.6 ly", dx: 44, dy: 42, ax: 2, ay: 13, anchor: "start" },
    { name: "Epsilon Eridani", dist: "10.5 ly", dx: 66, dy: 10, ax: 5, ay: 3, anchor: "start" },
    { name: "Tau Ceti", dist: "11.9 ly", dx: 28, dy: 68, ax: 2, ay: 13, anchor: "start" },
  ].map((s) => ({
    ...s,
    x: galaxy.sol.x + s.dx,
    y: galaxy.sol.y + s.dy,
    lx: galaxy.sol.x + s.dx + s.ax,
    ly: galaxy.sol.y + s.dy + s.ay,
  }));

  // Orion Triangle boundary — Betelgeuse, Bellatrix, and Rigel mark the
  // alliance frontier enclosing Sol, the capital, and the neighborhood.


  // Curated warp gates from the operator console. Each row links two sector
  // slugs; we resolve live positions client-side so moving a sector moves its
  // lanes and gates too.
  const gateRows = useQuery(api.content.warpGates);
  const boundaryRows = useQuery(api.content.mapBoundaries);

  // Curated boundary polygons resolved against live sector positions.
  const boundaries = useMemo(() => {
    const bySlug = new Map((sectors ?? []).map((s) => [s.slug, s]));
    return (boundaryRows ?? [])
      .map((b) => {
        const pts = b.sectorSlugs
          .map((slug) => bySlug.get(slug))
          .filter((s): s is NonNullable<typeof s> => !!s)
          .map((s) => ({ x: s.x, y: s.y }));
        if (pts.length < 3) return null;
        return { id: b._id as string, name: b.name, pts };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }, [boundaryRows, sectors]);

  // Curated lanes + gate markers. When no gates are defined yet, we fall back
  // to the original pairwise connection lines so the chart still reads well.
  const gateLanes = useMemo(() => {
    const bySlug = new Map((sectors ?? []).map((s) => [s.slug, s]));
    return (gateRows ?? [])
      .map((g) => {
        const a = bySlug.get(g.fromSlug);
        const b = bySlug.get(g.toSlug);
        if (!a || !b) return null;
        const hueIndex = (a.x + a.y + b.x + b.y) | 0;
        return {
          id: g._id as string,
          label: g.label,
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          gx: (a.x + b.x) / 2,
          gy: (a.y + b.y) / 2,
          color: HUES[hueIndex % HUES.length].glow,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
  }, [gateRows, sectors]);

  // Member warp lanes — every APPROVED member system that declared a home
  // sector knits itself to that sector with a fainter, thinner lane. Reads as
  // a "registered civilian route" under the canon Starnet. Deep-space
  // proposals (no sector) stay unlinked. Approved-only comes free: the
  // discoveries query already filters status, so the Bridge canonizes each
  // lane by approving the survey.
  const memberLanes = useMemo(() => {
    const byName = new Map((sectors ?? []).map((s) => [s.name, s]));
    const lanes: Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      gx: number;
      gy: number;
    }> = [];
    for (const d of discoveries ?? []) {
      if (!d.sector) continue;
      const s = byName.get(d.sector);
      if (!s) continue;
      lanes.push({
        id: d._id,
        x1: d.x,
        y1: d.y,
        x2: s.x,
        y2: s.y,
        gx: (d.x + s.x) / 2,
        gy: (d.y + s.y) / 2,
      });
    }
    return lanes;
  }, [discoveries, sectors]);

  // Decorative starfield dots (stable across renders) — drawn per scene.
  const stars = useMemo(() => {
    const { vbX, vbY, vbW, vbH } = viewBox;
    return Array.from({ length: 70 }, (_, i) => ({
      x: vbX + seeded(i) * vbW,
      y: vbY + seeded(i * 2 + 1) * vbH,
      r: 0.6 + seeded(i * 3 + 2) * 1.4,
      o: 0.15 + seeded(i * 5 + 3) * 0.5,
    }));
  }, [viewBox]);

  // Greedy proximity clustering — systems closer than CLUSTER_R group into a
  // single node with a count, so dense regions never turn into a blob of text.
  const clusters = useMemo<Cluster[]>(() => {
    const list = (discoveries ?? []).slice(0, DRAW_CAP);
    const out: Cluster[] = [];
    for (const d of list) {
      let placed = false;
      for (const c of out) {
        if (Math.hypot(d.x - c.cx, d.y - c.cy) <= CLUSTER_R) {
          c.members.push(d);
          c.cx = c.members.reduce((s, m) => s + m.x, 0) / c.members.length;
          c.cy = c.members.reduce((s, m) => s + m.y, 0) / c.members.length;
          placed = true;
          break;
        }
      }
      if (!placed) out.push({ members: [d], cx: d.x, cy: d.y });
    }
    return out;
  }, [discoveries]);

  const total = discoveries?.length ?? 0;
  const capped = total > DRAW_CAP;

  // Exploration log — visiting a sector's neighborhood on the chart feeds
  // the First Watch "visit three worlds" objective and the Wayfarer badge.
  const logVisit = useMutation(api.engagement.logAtlasVisit);
  const loggedFor = useRef<Set<string>>(new Set());
  const handleSectorVisited = useCallback(
    (sectorName: string) => {
      if (!isAuthenticated || loggedFor.current.has(sectorName)) return;
      loggedFor.current.add(sectorName); // dedupe per session; server dedupes forever
      void logVisit({ sectorName }).catch(() => {
        loggedFor.current.delete(sectorName);
      });
    },
    [isAuthenticated, logVisit],
  );

  const openProposeAt = (x: number, y: number) => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    setProposePos({ x: Math.round(x), y: Math.round(y) });
    setTitle("");
    setDescription("");
    // Pre-tag the sector when proposing from inside a sector chart.
    setSector(activeSector?.name ?? "");
    setFaction("");
    setMissionId("");
    setProposingSector(false);
    setProposeOpen(true);
  };

  // Propose a brand-new sector — placement happens on the galaxy chart
  // after the form closes (click empty space, or skip to use the center).
  const openProposeSector = () => {
    if (!isAuthenticated) {
      setAuthOpen(true);
      return;
    }
    setProposePos(null);
    setTitle("");
    setDescription("");
    setSector("");
    setFaction("");
    setMissionId("");
    setProposingSector(true);
    setProposeOpen(true);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    // Only clicks on the empty chart background reach here — node clicks
    // stop propagation first. A drag-release also lands here, so ignore
    // clicks that follow real pointer movement.
    if (dragMoved.current) {
      dragMoved.current = false;
      return;
    }
    const p = pointerToBase(e);
    if (!p) return;
    // Galaxy chart: a click inside a sector's region opens that sector's
    // focused chart (the overlay handles system-level mapping).
    const hits = (sectors ?? [])
      .map((s) => ({ s, d: Math.hypot(s.x - p.x, s.y - p.y) }))
      .filter((h) => h.d <= (h.s.r ?? DEFAULT_SECTOR_R))
      .sort((a, b) => a.d - b.d);
    if (hits.length > 0) {
      enterSector(hits[0].s.name);
      return;
    }
    // Otherwise: exploration logging near a sector + free-space proposal.
    const nearest = (sectors ?? [])
      .map((s) => ({ s, d: Math.hypot(s.x - p.x, s.y - p.y) }))
      .sort((a, b) => a.d - b.d)[0];
    if (nearest && nearest.d <= SECTOR_VISIT_RADIUS) handleSectorVisited(nearest.s.name);
    openProposeAt(p.x, p.y);
  };

  const submitProposal = async (e: FormEvent) => {
    e.preventDefault();
    if (!proposePos) return;
    if (!title.trim()) {
      toast.info(proposingSector ? "Name the sector you charted." : "Name the system you discovered.");
      return;
    }
    // Sector proposals without a picked spot land at the galaxy-frame center;
    // placement can be refined later in the console.
    const pos = proposePos ?? {
      x: Math.round(viewBox.vbX + viewBox.vbW / 2),
      y: Math.round(viewBox.vbY + viewBox.vbH / 2),
    };
    setBusy(true);
    try {
      await propose({
        title: title.trim(),
        description: description.trim() || undefined,
        x: pos.x,
        y: pos.y,
        kind: proposingSector ? "sector" : "system",
        sector: proposingSector ? undefined : activeSector ? activeSector.name : sector || undefined,
        sectorSlug: proposingSector ? undefined : activeSector?.slug,
        faction: faction || undefined,
        missionId: (missionId as any) || undefined,
      });
      toast.success(
        proposingSector
          ? "Sector proposed — the Bridge will review it."
          : "System proposed — the Bridge will review it.",
      );
      setProposeOpen(false);
      setProposePos(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't submit the proposal.");
    } finally {
      setBusy(false);
    }
  };

  const isNew = (d: Discovery) => Date.now() - d.createdAt < 7 * 86_400_000;

  const clusterKey = (c: Cluster) => c.members.map((m) => m._id).join("|");
  const hoverKey = (c: Cluster) => (c.members.length === 1 ? c.members[0]._id : `cluster:${clusterKey(c)}`);

  if (loading) {
    return (
      <HoloCard>
        <div className="uf-skeleton" style={{ height }} />
      </HoloCard>
    );
  }

  return (
    <>
      <HoloCard>
        <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <span className="uf-eyebrow flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> Charted space
            </span>
            <h2 className="text-xl mt-1">The Orion Triangle — Live Survey Chart</h2>
            <p className="text-uf-muted text-xs mt-1 max-w-[56ch]">
              {activeSector
                ? `Sector chart — ${activeSector.name}. Click empty space to chart a system pre-tagged to this sector; nodes show canon and member systems.`
                : "Galaxy view — every glowing region is a sector. Click one to open its sector chart and map systems. Click empty space to propose a whole new sector."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill variant="success">
              {total} member-charted
            </StatusPill>
            {activeSector ? (
              <button
                type="button"
                onClick={exitToGalaxy}
                className="rounded-full border border-[rgba(0,229,255,0.45)] bg-[rgba(0,229,255,0.08)] px-3 py-1.5 text-xs text-uf-cyan hover:bg-[rgba(0,229,255,0.16)] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                ← Back to galaxy
              </button>
            ) : (
              <button
                type="button"
                onClick={openProposeSector}
                className="rounded-full border border-[rgba(139,92,246,0.5)] bg-[rgba(139,92,246,0.1)] px-3 py-1.5 text-xs text-[var(--uf-violet)] hover:bg-[rgba(139,92,246,0.2)] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Crosshair className="h-3.5 w-3.5" aria-hidden /> Propose new sector
              </button>
            )}
          </div>
        </header>

        <div
          className="relative overflow-hidden rounded-md"
          style={{
            background:
              "radial-gradient(closest-side at 50% 50%, rgba(0,229,255,0.08), transparent 70%), radial-gradient(closest-side at 20% 80%, rgba(139,92,246,0.06), transparent 70%), var(--uf-navy)",
            border: "1px solid var(--uf-border)",
            height,
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`${viewBox.vbX + pan.x} ${viewBox.vbY + pan.y} ${viewBox.vbW / zoom} ${viewBox.vbH / zoom}`}
            preserveAspectRatio="xMidYMid meet"
            className={`w-full h-full ${dragging ? "cursor-grabbing" : "cursor-crosshair"}`}
            role="img"
            aria-label="Interactive galaxy map. Pinch or use the zoom buttons to zoom, drag to pan, click empty space to propose a system."
            style={{ touchAction: "pan-y" }}
            onClick={handleSvgClick}
            onPointerDown={onDragStart}
            onPointerMove={onPointerMove}
            onPointerUp={onDragEnd}
            onPointerLeave={onDragEnd}
            onDoubleClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          >
            <title>The Orion Triangle — Live Survey Chart</title>
            <desc>
              Interactive SVG of Star Force Base 1198 space. Canon sectors link
              to lore; member-charted systems show surveys. Click empty space
              to propose a new system.
            </desc>

            <defs>
              {/* Holographic bloom — sector discs and capital stars read as
                  glowing holos instead of flat circles. */}
              <filter id="uf-holo-bloom" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.55 0"
                  result="bloom"
                />
                <feMerge>
                  <feMergeNode in="bloom" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Cartography grid — faint graticule behind the starfield so the
                chart reads as a nav display rather than a black rectangle. */}
            <g aria-hidden="true" opacity={0.16}>
              <defs>
                <pattern
                  id="uf-atlas-grid"
                  width={56}
                  height={56}
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 56 0 L 0 0 0 56"
                    fill="none"
                    stroke="rgba(0,229,255,0.5)"
                    strokeWidth={0.4}
                  />
                </pattern>
              </defs>
              <rect
                x={viewBox.vbX}
                y={viewBox.vbY}
                width={viewBox.vbW}
                height={viewBox.vbH}
                fill="url(#uf-atlas-grid)"
              />
            </g>

            {/* Real-galaxy backdrop — NASA/JPL-Caltech/R. Hurt Milky Way map,
                cover-fitted into chart coordinates (decorative, aria-hidden) */}
            {layers.galaxy && !activeSector && (
              <g aria-hidden="true">
                <image
                  href={milkyWayUrl}
                  x={galaxy.rect.x}
                  y={galaxy.rect.y}
                  width={galaxy.rect.w}
                  height={galaxy.rect.h}
                  preserveAspectRatio="xMidYMid slice"
                  opacity={0.85}
                  transform={`rotate(180 ${galaxy.rect.x + galaxy.rect.w / 2} ${
                    galaxy.rect.y + galaxy.rect.h / 2
                  })`}
                />
                {/* Readability scrim so interactive layers stay crisp on top */}
                <rect
                  x={viewBox.vbX}
                  y={viewBox.vbY}
                  width={viewBox.vbW}
                  height={viewBox.vbH}
                  fill="rgba(5,8,22,0.45)"
                />
              </g>
            )}

            {/* Decorative starfield */}
            {layers.stars && (
              <g>
                {stars.map((s, i) => (
                  <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#bfe9ff" opacity={s.o} />
                ))}
              </g>
            )}

            {/* Canon Starnet — operator-curated lanes, full-strength styling.
                Hovering a lane reveals its registered gate label. */}
            {layers.connections && !activeSector && gateLanes.length > 0 && (
              <g strokeLinecap="round">
                {gateLanes.map((l) => (
                  <g key={l.id}>
                    <line
                      className="uf-transit-lane"
                      x1={l.x1}
                      y1={l.y1}
                      x2={l.x2}
                      y2={l.y2}
                      stroke={l.color}
                      strokeWidth={0.9 * UI}
                      opacity={hoverGateId === l.id ? 1 : 0.85}
                    />
                    {/* Wide invisible hit-line so hover works on thin strokes */}
                    <line
                      x1={l.x1}
                      y1={l.y1}
                      x2={l.x2}
                      y2={l.y2}
                      stroke="transparent"
                      strokeWidth={10 * UI}
                      style={{ pointerEvents: "stroke" }}
                      onMouseEnter={() => setHoverGateId(l.id)}
                      onMouseLeave={() => setHoverGateId(null)}
                    />
                    {hoverGateId === l.id && (
                      <g>
                        <rect
                          x={l.gx - Math.max(30 * UI, (l.label.length * 3.4 * UI))}
                          y={l.gy - 24 * UI}
                          width={Math.max(60 * UI, l.label.length * 6.8 * UI)}
                          height={16 * UI}
                          rx={4 * UI}
                          fill="rgba(5,8,22,0.92)"
                          stroke={l.color}
                          strokeWidth={0.6 * UI}
                        />
                        <text
                          x={l.gx}
                          y={l.gy - 12.5 * UI}
                          fontSize={9 * UI}
                          fill={l.color}
                          textAnchor="middle"
                          fontWeight={600}
                          letterSpacing={0.8 * UI}
                        >
                          {l.label}
                        </text>
                      </g>
                    )}
                  </g>
                ))}
              </g>
            )}

            {/* Civilian routes — galaxy scene only; member systems knit to
                their sectors inside the sector views instead */}
            {layers.connections && !activeSector && (
              <g strokeLinecap="round">
                {memberLanes.map((l) => (
                  <line
                    key={l.id}
                    className="uf-transit-lane"
                    x1={l.x1}
                    y1={l.y1}
                    x2={l.x2}
                    y2={l.y2}
                    stroke="var(--uf-text-muted)"
                    strokeWidth={0.55 * UI}
                    opacity={0.45}
                  />
                ))}
              </g>
            )}

            {/* Warp gates — canon gates on curated lanes; hover shows the
                gate's registered name and route */}
            {layers.connections && !activeSector && gateLanes.length > 0 && (
              <g>
                {gateLanes.map((l) => (
                  <g
                    key={l.id}
                    transform={`translate(${l.gx} ${l.gy})`}
                    onMouseEnter={() => setHoverGateId(l.id)}
                    onMouseLeave={() => setHoverGateId(null)}
                    style={{ cursor: "help" }}
                  >
                    <title>{`${l.label} — ${l.label} Gate · hover the lane for its registered route`}</title>
                    <circle
                      r={7 * UI}
                      fill="none"
                      stroke={l.color}
                      strokeWidth={0.6 * UI}
                      opacity={hoverGateId === l.id ? 0.9 : 0.35}
                      className="uf-warp-gate"
                    />
                    <rect
                      x={-2.2 * UI}
                      y={-2.2 * UI}
                      width={4.4 * UI}
                      height={4.4 * UI}
                      transform="rotate(45)"
                      fill="var(--uf-navy)"
                      stroke={l.color}
                      strokeWidth={1 * UI}
                      rx={0.6 * UI}
                      className="uf-warp-gate"
                    />
                    {hoverGateId === l.id && (
                      <g transform={`translate(0 ${-14 * UI})`}>
                        <rect
                          x={-Math.max(32 * UI, l.label.length * 3.6 * UI)}
                          y={-10 * UI}
                          width={Math.max(64 * UI, l.label.length * 7.2 * UI)}
                          height={16 * UI}
                          rx={4 * UI}
                          fill="rgba(5,8,22,0.92)"
                          stroke={l.color}
                          strokeWidth={0.6 * UI}
                        />
                        <text
                          x={0}
                          y={1.5 * UI}
                          fontSize={9 * UI}
                          fill={l.color}
                          textAnchor="middle"
                          fontWeight={600}
                        >
                          {l.label}
                        </text>
                      </g>
                    )}
                  </g>
                ))}
              </g>
            )}

            {/* Civilian gates — galaxy scene only (see lanes above) */}
            {layers.connections && !activeSector && (
              <g aria-hidden="true">
                {memberLanes.map((l) => (
                  <g key={l.id} transform={`translate(${l.gx} ${l.gy})`}>
                    <circle r={4.5 * UI} fill="none" stroke="var(--uf-text-muted)" strokeWidth={0.5 * UI} opacity={0.25} className="uf-warp-gate" />
                    <rect
                      x={-1.5 * UI}
                      y={-1.5 * UI}
                      width={3 * UI}
                      height={3 * UI}
                      transform="rotate(45)"
                      fill="var(--uf-navy)"
                      stroke="var(--uf-text-muted)"
                      strokeWidth={0.7 * UI}
                      rx={0.4 * UI}
                      className="uf-warp-gate"
                    />
                  </g>
                ))}
              </g>
            )}

            {/* Sol — humanity's home star on the Orion Spur, linking into the
                Sol-sector lore archive */}
            {layers.sectors && !activeSector && (
              <a
                href="/lore?sector=Sol"
                role="link"
                aria-label="Open Sol sector lore"
                onClick={(e) => e.stopPropagation()}
              >
                <circle cx={galaxy.sol.x} cy={galaxy.sol.y} r={10 * UI} fill="var(--uf-gold)" fillOpacity={0.12} className="uf-warp-gate" />
                <circle cx={galaxy.sol.x} cy={galaxy.sol.y} r={5.5 * UI} fill="none" stroke="var(--uf-gold)" strokeWidth={1 * UI} opacity={0.8} filter="url(#uf-holo-bloom)" />
                <circle cx={galaxy.sol.x} cy={galaxy.sol.y} r={2 * UI} fill="var(--uf-gold)" />
                <text
                  x={galaxy.sol.x + 9 * UI}
                  y={galaxy.sol.y - 6 * UI}
                  fontSize={11 * UI}
                  fill="var(--uf-gold)"
                  fontWeight={600}
                  stroke="#050816"
                  strokeWidth={3 * UI}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                >
                  Sol
                </text>
              </a>
            )}

            {/* 47 Ursae Majoris — Alliance Capital: gold star insignia.
                Clickable: dives into the Sol sector chart, where the real
                47 Uma catalog entry lives. */}
            {!activeSector && (
            <g
              role="button"
              tabIndex={0}
              aria-label="47 Ursae Majoris — Alliance Capital. Open the Sol sector chart."
              onClick={(e) => {
                e.stopPropagation();
                const sol = (sectors ?? []).find((s) => /sol/i.test(s.name));
                if (sol) enterSector(sol.name, "47 Ursae Majoris");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  const sol = (sectors ?? []).find((s) => /sol/i.test(s.name));
                  if (sol) enterSector(sol.name, "47 Ursae Majoris");
                }
              }}
              className="cursor-pointer"
            >
              <title>47 Ursae Majoris — Alliance Capital · click to open its sector chart</title>
              <circle cx={uma47.x} cy={uma47.y} r={8 * UI} fill="var(--uf-gold)" fillOpacity={0.1} />
              <circle cx={uma47.x} cy={uma47.y} r={5 * UI} fill="none" stroke="var(--uf-gold)" strokeWidth={1 * UI} opacity={0.9} />
              <circle cx={uma47.x} cy={uma47.y} r={1.6 * UI} fill="var(--uf-gold)" />
              <polygon
                points={starPoints(uma47.x, uma47.y - 11 * UI, 4 * UI)}
                fill="var(--uf-gold)"
                stroke="var(--uf-navy)"
                strokeWidth={0.4 * UI}
              />
              <text
                x={uma47.x + 9 * UI}
                y={uma47.y + 2 * UI}
                fontSize={9.5 * UI}
                fill="var(--uf-text)"
                fontWeight={600}
                stroke="#050816"
                strokeWidth={3 * UI}
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                47 Ursae Majoris
              </text>
              <text
                x={uma47.x + 9 * UI}
                y={uma47.y + 12 * UI}
                fontSize={6.5 * UI}
                fill="var(--uf-gold)"
                letterSpacing={1.5 * UI}
                stroke="#050816"
                strokeWidth={2.5 * UI}
                paintOrder="stroke"
                strokeLinejoin="round"
              >
                ALLIANCE CAPITAL
              </text>
            </g>
            )}

            {/* Operator-curated named boundaries — e.g. the Orion Triangle.
                Pure operator data: nothing renders until one is defined. */}
            {layers.sectors && !activeSector && boundaries.length > 0 && (
              <g aria-hidden="true">
                {boundaries.map((b) => {
                  const labelAt = b.pts.reduce(
                    (acc, p) => ({ x: acc.x + p.x / b.pts.length, y: acc.y + p.y / b.pts.length }),
                    { x: 0, y: 0 },
                  );
                  return (
                    <g key={b.id}>
                      <title>{b.name}</title>
                      <path
                        d={`M ${b.pts.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`}
                        fill="none"
                        stroke="var(--uf-gold)"
                        strokeWidth={0.7 * UI}
                        opacity={0.4}
                      />
                      <text
                        x={labelAt.x}
                        y={labelAt.y}
                        fontSize={8 * UI}
                        fill="var(--uf-gold)"
                        opacity={0.75}
                        textAnchor="middle"
                        letterSpacing={3 * UI}
                      >
                        {b.name.toUpperCase()}
                      </text>
                      {b.pts.map((p, i) => (
                        <polygon
                          key={`${b.id}-${i}`}
                          points={trianglePoints(p.x, p.y, 4 * UI)}
                          fill="var(--uf-navy)"
                          stroke="var(--uf-gold)"
                          strokeWidth={0.9 * UI}
                        />
                      ))}
                    </g>
                  );
                })}
              </g>
            )}

            {/* Solar neighborhood — closest real systems to Earth (galaxy
                scene) */}
            {layers.sectors && !activeSector && (
              <g aria-hidden="true">
                {localSystems.map((s) => (
                  <g key={s.name}>
                    <title>{`${s.name} — ${s.dist} from Sol`}</title>
                    <circle cx={s.x} cy={s.y} r={3.5 * UI} fill="none" stroke="var(--uf-text)" strokeWidth={0.4 * UI} opacity={0.35} />
                    <circle cx={s.x} cy={s.y} r={1.6 * UI} fill="var(--uf-text)" opacity={0.9} />
                    <text
                      x={s.lx}
                      y={s.ly}
                      fontSize={6.5 * UI}
                      fill="var(--uf-muted)"
                      textAnchor={s.anchor as "start" | "end"}
                      stroke="#050816"
                      strokeWidth={2.2 * UI}
                      paintOrder="stroke"
                      strokeLinejoin="round"
                    >
                      {s.name}
                    </text>
                  </g>
                ))}
              </g>
            )}

            {/* Sector regions — the galaxy scene's interactive layer. Each
                sector renders as a large clickable influence disc; clicking
                dives the camera into that sector's local chart. */}
            {layers.sectors && !activeSector && (
              <g>
                {(sectors ?? []).map((s, i) => {
                  const hue = HUES[i % HUES.length];
                  const rr = s.r ?? DEFAULT_SECTOR_R;
                  const hovered = hoverSectorId === s._id;
                  const draggingThis = dragSectorPos?.id === s._id;
                  const pos = draggingThis ? dragSectorPos! : { x: s.x, y: s.y };
                  const systemCount = (discoveries ?? []).filter((d) => d.sector === s.name).length;
                  return (
                    <g
                      key={s._id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Enter ${s.name} sector (${s.loreCount ?? 0} lore, ${systemCount} charted systems)`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (sectorJustDragged.current) {
                          sectorJustDragged.current = false;
                          return;
                        }
                        if (!dragSectorRef.current) enterSector(s.name);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          enterSector(s.name);
                        }
                      }}
                      onPointerDown={(e) => onSectorDragStart(e, s)}
                      onPointerUp={() => void commitSectorDrag()}
                      onMouseEnter={() => setHoverSectorId(s._id)}
                      onMouseLeave={() => setHoverSectorId(null)}
                      className={isOperator ? "cursor-grab" : "cursor-pointer"}
                      opacity={pendingSectorName === s.name ? 0.55 : 1}
                    >
                      <title>{`${s.name} — click to dive into the sector chart${isOperator ? " · drag to reposition" : ""}`}</title>
                      {/* Hover halo — soft outer ring that fills in on hover */}
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={rr + 10 * UI}
                        fill="none"
                        stroke={hue.glow}
                        strokeOpacity={hovered ? 0.25 : 0}
                        strokeWidth={3 * UI}
                      />
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={rr}
                        fill={hue.glow}
                        fillOpacity={hovered ? 0.16 : 0.07}
                        stroke={hue.glow}
                        strokeOpacity={hovered ? 0.9 : 0.4}
                        strokeWidth={hovered ? 1.6 * UI : 1 * UI}
                        strokeDasharray={`${3 * UI} ${4 * UI}`}
                        className="transition-opacity"
                        filter="url(#uf-holo-bloom)"
                      />
                      <circle cx={pos.x} cy={pos.y} r={4 * UI} fill={hue.glow} />
                      {/* Name plate — dark glass strip so labels stay readable
                          over any backdrop */}
                      <rect
                        x={pos.x - Math.max(34 * UI, s.name.length * 3.6 * UI)}
                        y={pos.y + rr + 6 * UI}
                        width={Math.max(68 * UI, s.name.length * 7.2 * UI)}
                        height={15 * UI}
                        rx={4 * UI}
                        fill="rgba(5,8,22,0.82)"
                        stroke={hue.glow}
                        strokeOpacity={hovered ? 0.7 : 0.28}
                        strokeWidth={0.5 * UI}
                      />
                      <text
                        x={pos.x}
                        y={pos.y + rr + 14 * UI}
                        fontSize={11.5 * UI}
                        fill="var(--uf-text)"
                        textAnchor="middle"
                        stroke="#050816"
                        strokeWidth={3 * UI}
                        paintOrder="stroke"
                        strokeLinejoin="round"
                        fontWeight={600}
                      >
                        {s.name}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y + rr + 26 * UI}
                        fontSize={8.5 * UI}
                        fill="var(--uf-muted)"
                        textAnchor="middle"
                        stroke="#050816"
                        strokeWidth={2.5 * UI}
                        paintOrder="stroke"
                        strokeLinejoin="round"
                      >
                        {s.loreCount ?? 0} lore · {systemCount} systems
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* Member-charted discovery clusters — galaxy scene density
                dots under the sector regions; sector scenes have their own
                focused overlay chart below */}
            {layers.discoveries && !activeSector && (
              <g>
                {clusters.map((c) => {
                  const single = c.members.length === 1;
                  const first = c.members[0];
                  const key = hoverKey(c);
                  const hovering = hoverId === key;
                  const label = single
                    ? first.title
                    : `${c.members.length} systems`;
                  return (
                    <g
                      key={key}
                      role="button"
                      tabIndex={0}
                      aria-label={label}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (single) setDetail(first);
                        else setClusterOpen(c);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          if (single) setDetail(first);
                          else setClusterOpen(c);
                        }
                      }}
                      onMouseEnter={() => setHoverId(key)}
                      onMouseLeave={() => setHoverId(null)}
                      onFocus={() => setHoverId(key)}
                      onBlur={() => setHoverId(null)}
                      style={{ cursor: "pointer" }}
                    >
                      <circle cx={c.cx} cy={c.cy} r={single ? 11 * UI : 13 * UI} fill="rgba(80,255,160,0.12)" />
                      <circle
                        cx={c.cx}
                        cy={c.cy}
                        r={single ? 6.5 * UI : 8 * UI}
                        fill="rgba(80,255,160,0.28)"
                        stroke="var(--uf-green)"
                        strokeWidth={1.4 * UI}
                      />
                      {/* crosshair */}
                      <line x1={c.cx - 3 * UI} y1={c.cy} x2={c.cx + 3 * UI} y2={c.cy} stroke="var(--uf-green)" strokeWidth={0.9 * UI} />
                      <line x1={c.cx} y1={c.cy - 3 * UI} x2={c.cx} y2={c.cy + 3 * UI} stroke="var(--uf-green)" strokeWidth={0.9 * UI} />
                      {!single && (
                        <text x={c.cx} y={c.cy + 3 * UI} fontSize={8 * UI} fill="var(--uf-green)" textAnchor="middle" fontWeight={700}>
                          {c.members.length}
                        </text>
                      )}
                      {/* Label only on hover/focus — keeps the chart uncluttered */}
                      {hovering && (
                        <g>
                          <rect
                            x={c.cx - 40 * UI}
                            y={c.cy - 30 * UI}
                            width={80 * UI}
                            height={16 * UI}
                            rx={4 * UI}
                            fill="rgba(5,8,22,0.85)"
                            stroke="rgba(80,255,160,0.5)"
                          />
                          <text x={c.cx} y={c.cy - 18 * UI} fontSize={9 * UI} fill="var(--uf-green)" textAnchor="middle" fontWeight={600}>
                            {label}
                          </text>
                          {single && isNew(first) && (
                            <text x={c.cx + 9 * UI} y={c.cy - 22 * UI} fontSize={7 * UI} fill="var(--uf-gold)" textAnchor="start" fontWeight={700}>
                              NEW
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            )}
          </svg>

          {/* Focused sector chart - replaces the galaxy view while a sector
              is open. Owns its own camera and system-level interactions. */}
          {activeSector && (
            <div className="absolute inset-0 z-20 bg-[rgba(5,8,22,0.97)]">
              <SectorChart
                key={activeSector.slug}
                sector={activeSector}
                systems={sectorSystems}
                height={height}
                focusName={focusSystemName}
                onBack={exitToGalaxy}
                onPropose={(x, y) => openProposeAt(x, y)}
                canSeed={isOperator}
                seeding={seeding}
                seedResult={seedResult}
                onSeed={() => {
                  seedLocalGroup({ sectorSlug: activeSector.slug, includeSol: true, includeUma: true })
                    .then((res) => {
                      setSeedResult({ added: res.added, skipped: res.skipped });
                      toast.success(
                        res.added > 0
                          ? `Local group seeded \u2014 ${res.added} catalog stars placed${res.skipped ? `, ${res.skipped} already charted` : ""}.`
                          : "This sector is already fully charted \u2014 nothing new to add.",
                      );
                    })
                    .catch((err) =>
                      toast.error(err instanceof Error ? err.message : "Seeding failed."),
                    )
                    .finally(() => setSeeding(false));
                }}
              />
            </div>
          )}

          {/* Zoom controls — bottom of the chart where the densest systems
              and most editing happen. Big 44px+ targets (WCAG 2.2 AA), and
              each tap zooms toward the pointer so you can aim at an area
              and dive straight in. */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={() => zoomBy(1.5)}
              disabled={zoom >= MAP_MAX_ZOOM}
              aria-label="Zoom in"
              className="h-11 w-11 grid place-items-center rounded-full border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.9)] text-uf-text hover:border-[rgba(0,229,255,0.6)] hover:text-uf-cyan active:scale-95 disabled:opacity-40 transition-all"
            >
              <Plus className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.5)}
              disabled={zoom <= MAP_MIN_ZOOM}
              aria-label="Zoom out"
              className="h-11 w-11 grid place-items-center rounded-full border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.9)] text-uf-text hover:border-[rgba(0,229,255,0.6)] hover:text-uf-cyan active:scale-95 disabled:opacity-40 transition-all"
            >
              <Minus className="h-5 w-5" aria-hidden />
            </button>
            {zoom !== 1 && (
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                aria-label="Reset map zoom and position"
                className="h-11 w-11 grid place-items-center rounded-full border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.9)] text-uf-muted hover:text-uf-text hover:border-[rgba(0,229,255,0.6)] active:scale-95 transition-all"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>

          {/* Floating propose hint — top-left, clear of the bottom controls */}
          <div className="absolute top-3 left-3 pointer-events-none">
            <span className="text-[10px] uppercase tracking-[0.16em] text-uf-muted bg-[rgba(5,8,22,0.7)] border border-[color:var(--uf-border)] rounded-full px-2.5 py-1">
              {isAuthenticated
                ? "Pinch or +/− to zoom · drag to pan · click empty space to chart"
                : "Sign in to chart a system"}
            </span>
          </div>
          {isOperator && hoverSectorId && !activeSector && (
            <div className="absolute top-3 right-3 pointer-events-none z-10">
              <span className="text-[10px] uppercase tracking-[0.14em] text-uf-cyan bg-[rgba(5,8,22,0.85)] border border-[rgba(0,229,255,0.4)] rounded-full px-2.5 py-1">
                Click to dive · drag disc to reposition
              </span>
            </div>
          )}
        </div>

        {/* Layer toggles + legend */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-uf-muted mr-1">Display:</span>
          {LAYERS.map((l) => (
            <button
              key={l.key}
              type="button"
              aria-pressed={layers[l.key]}
              onClick={() => setLayers((s) => ({ ...s, [l.key]: !s[l.key] }))}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                layers[l.key]
                  ? "border-[rgba(0,229,255,0.5)] bg-[rgba(0,229,255,0.1)] text-uf-text"
                  : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] text-uf-muted hover:text-uf-text"
              }`}
            >
              {l.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-uf-muted">
            {capped ? `Showing latest ${DRAW_CAP} of ${total} charted systems. ` : ""}
            Labels appear on hover.
          </span>
        </div>

        {/* How it works */}
        <div className="mt-4 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] p-4">
          <p className="uf-eyebrow">How charting works</p>
          <ol className="list-decimal list-inside text-sm text-uf-muted mt-2 space-y-1">
            <li>Click any empty region of the chart.</li>
            <li>Name the system and describe what your survey found.</li>
            <li>The Bridge reviews your proposal — approved systems are charted and award <span className="text-[var(--uf-green)]">+25 XP</span>.</li>
          </ol>
        </div>
      </HoloCard>

      {/* Propose dialog */}
      <Dialog open={proposeOpen} onOpenChange={setProposeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chart a new system</DialogTitle>
            <DialogDescription>
              Position ({proposePos?.x ?? 0}, {proposePos?.y ?? 0}) — your survey will be reviewed by the Bridge.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitProposal} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uf-muted">System name</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={60}
                placeholder="e.g. Kestrel Run"
                className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uf-muted">Survey notes</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={400}
                rows={3}
                placeholder="What did your survey find? Wrecks, signals, hazards, what you propose to call the region…"
                className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text placeholder:text-uf-muted/60 focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Nearest sector</span>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                >
                  <option value="">None / deep space</option>
                  {(sectors ?? []).map((s) => (
                    <option key={s._id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-uf-muted">Claiming faction</span>
                <select
                  value={faction}
                  onChange={(e) => setFaction(e.target.value)}
                  className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
                >
                  <option value="">No claim</option>
                  {(factions?.items ?? []).map((f) => (
                    <option key={f.slug} value={f.name}>{f.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uf-muted">Related operation <span className="text-uf-muted/60">(optional)</span></span>
              <select
                value={missionId}
                onChange={(e) => setMissionId(e.target.value)}
                className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.6)] px-3 py-2 text-sm text-uf-text focus:border-[rgba(0,229,255,0.5)] focus:outline-none"
              >
                <option value="">Independent survey</option>
                {activeMissions.map((m) => (
                  <option key={m._id} value={m._id}>{m.title} (+{m.xpReward ?? 0} XP)</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 mt-1">
              <NeonButton variant="ghost" type="button" onClick={() => setProposeOpen(false)}>
                Cancel
              </NeonButton>
              <NeonButton variant="primary" type="submit" loading={busy}>
                <MapPin className="h-4 w-4 mr-1.5" aria-hidden />
                Submit survey
              </NeonButton>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Sign-in prompt */}
      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in to chart</DialogTitle>
            <DialogDescription>
              Only fleet members can propose surveys. It takes a minute — and approved systems earn XP.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <NeonButton variant="ghost" onClick={() => setAuthOpen(false)}>Close</NeonButton>
            <Link to="/auth?returnTo=/map">
              <NeonButton variant="primary">
                <Plus className="h-4 w-4 mr-1.5" aria-hidden />
                Sign in
              </NeonButton>
            </Link>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discovery detail */}
      <Dialog open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
            <DialogDescription>
              Charted {detail ? new Date(detail.createdAt).toLocaleDateString() : ""} by{" "}
              {detail?.author?.displayName ?? "unknown"} · {detail?.author?.rank ?? "Recruit"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {detail?.sector && (
              <p className="text-sm text-uf-muted">
                Nearest sector: <span className="text-uf-text">{detail.sector}</span>
              </p>
            )}
            {detail?.faction && (
              <p className="text-sm text-uf-muted">
                Claiming faction: <span className="text-uf-text">{detail.faction}</span>
              </p>
            )}
            <p className="text-sm text-uf-text/90">{detail?.description || "No survey notes filed."}</p>
            {detail && isNew(detail) && (
              <StatusPill variant="success">Recently charted</StatusPill>
            )}
            <div className="mt-1 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                disabled={voting || !isAuthenticated}
                onClick={async () => {
                  if (!detail || voting) return;
                  setVoting(true);
                  try {
                    const res = await vote({ id: detail._id as any });
                    setDetail({
                      ...detail,
                      voteCount: detail.voteCount + (res.voted ? 1 : -1),
                      myVote: res.voted,
                    });
                    toast.success(res.voted ? "Endorsement logged." : "Endorsement withdrawn.");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't vote.");
                  } finally {
                    setVoting(false);
                  }
                }}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  detail?.myVote
                    ? "border-[rgba(0,229,255,0.6)] bg-[rgba(0,229,255,0.12)] text-uf-cyan"
                    : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] text-uf-muted hover:text-uf-text"
                }`}
              >
                {detail?.myVote ? "✦ Endorsed" : "✦ Endorse this survey"}
                <span className="ml-1.5 opacity-80">({detail?.voteCount ?? 0})</span>
              </button>
              {!isAuthenticated && (
                <Link to="/auth?returnTo=/maps" className="text-xs text-uf-cyan underline">
                  Sign in to endorse
                </Link>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cluster list */}
      <Dialog open={clusterOpen !== null} onOpenChange={(o) => !o && setClusterOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Charted systems in this region</DialogTitle>
            <DialogDescription>
              {clusterOpen?.members.length ?? 0} surveys grouped here — click one for details.
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2 list-none p-0 m-0 max-h-72 overflow-y-auto">
            {(clusterOpen?.members ?? []).map((m) => (
              <li key={m._id}>
                <button
                  type="button"
                  onClick={() => {
                    setClusterOpen(null);
                    setDetail(m);
                  }}
                  className="w-full text-left rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] px-3 py-2 hover:border-[rgba(0,229,255,0.4)] transition-colors"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-uf-text">{m.title}</span>
                    <span className="text-[11px] text-uf-muted">
                      {m.author?.displayName ?? "unknown"} · {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="block text-xs text-uf-muted mt-0.5 line-clamp-1">
                    {m.description || "No survey notes filed."}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
