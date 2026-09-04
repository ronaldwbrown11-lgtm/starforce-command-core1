import {
  CATEGORY_SILHOUETTE,
  SHIP_ACCENT_HEX,
  getShipAccent,
  getShipCategory,
  type SilhouetteKind,
} from "@/lib/ships";

// ---------------------------------------------------------------------------
// Procedural hull silhouettes — one line-art shape per category, tinted with
// the ship class accent. Pure SVG, no image assets, no network.
// ---------------------------------------------------------------------------

const HULL_PATHS: Record<SilhouetteKind, string[]> = {
  fighter: [
    "M8 34 L52 8 L78 8 L112 34 L96 34 L90 30 L70 30 L70 26 L92 22 L60 16 L34 22 L26 30 L18 34 Z",
    "M70 26 L70 14 L76 10 L80 16 Z",
    "M44 12 L50 6 L56 12 Z",
  ],
  destroyer: [
    "M6 22 L20 14 L30 12 L56 8 L96 16 L116 22 L116 30 L6 30 Z",
    "M56 8 L56 4 L64 4 L64 8 Z",
    "M96 16 L104 10 L112 16 Z",
  ],
  heavyDestroyer: [
    "M4 22 L18 12 L34 10 L58 8 L100 18 L118 22 L118 30 L4 30 Z",
    "M58 8 L58 3 L66 3 L66 8 Z",
    "M100 18 L108 12 L116 18 Z",
    "M34 10 L34 4 L42 4 L42 10 Z",
  ],
  cruiser: [
    "M8 24 L24 12 L44 10 L74 12 L112 24 L112 30 L8 30 Z",
    "M44 10 L48 4 L56 4 L60 10 Z",
    "M74 12 L74 6 L80 6 L80 12 Z",
  ],
  carrier: [
    "M10 18 L30 12 L90 12 L110 18 L110 30 L10 30 Z",
    "M30 12 L30 6 L46 6 L46 12 Z",
    "M82 12 L82 6 L96 6 L96 12 Z",
    "M56 8 L60 4 L64 8 Z",
  ],
  dreadnought: [
    "M4 20 L22 10 L44 8 L76 8 L102 14 L118 20 L118 32 L4 32 Z",
    "M44 8 L44 2 L52 2 L52 8 Z",
    "M76 8 L76 2 L84 2 L84 8 Z",
    "M102 14 L110 8 L118 14 Z",
    "M22 10 L26 4 L32 4 L36 10 Z",
  ],
  supercapital: [
    "M2 22 L16 8 L42 5 L78 5 L104 10 L120 22 L120 32 L2 32 Z",
    "M42 5 L42 -2 L52 -2 L52 5 Z",
    "M78 5 L78 -2 L88 -2 L88 5 Z",
    "M104 10 L114 3 L120 10 Z",
    "M16 8 L20 1 L28 1 L32 8 Z",
    "M56 5 L56 0 L62 0 L62 5 Z",
  ],
  ghost: [
    "M10 30 L34 10 L52 6 L70 10 L94 30 L86 30 L66 14 L52 12 L38 14 L18 30 Z",
    "M52 6 L52 2 L56 2 L56 6 Z",
    "M34 10 L30 4 L36 4 Z",
    "M70 10 L74 4 L68 4 Z",
  ],
  support: [
    "M14 22 L30 12 L46 10 L74 10 L96 16 L108 22 L108 30 L14 30 Z",
    "M46 10 L46 4 L54 4 L54 10 Z",
    "M74 10 L74 5 L80 5 L80 10 Z",
    "M96 16 L102 12 L108 16 Z",
  ],
  transport: [
    "M16 20 L34 14 L86 14 L104 20 L104 30 L16 30 Z",
    "M34 14 L38 8 L44 8 L48 14 Z",
    "M72 14 L76 8 L82 8 L86 14 Z",
    "M56 12 L60 7 L64 12 Z",
  ],
  drone: [
    "M24 26 L44 16 L60 16 L80 26 L80 30 L24 30 Z",
    "M44 16 L50 8 L56 16 Z",
    "M60 16 L60 10 L66 10 L66 16 Z",
    "M30 26 L30 22 L36 22 L36 26 Z",
    "M68 26 L68 22 L74 22 L74 26 Z",
  ],
};

export function ShipSilhouette({
  shipClass,
  kind,
  accent,
  className,
  title,
}: {
  shipClass?: string | null;
  kind?: SilhouetteKind;
  accent?: string;
  className?: string;
  title?: string;
}) {
  const resolvedAccent = accent ?? SHIP_ACCENT_HEX[getShipAccent(shipClass)];
  const resolvedKind =
    kind ?? (shipClass ? CATEGORY_SILHOUETTE[getShipCategory(shipClass) ?? "Fighters"] : "fighter");
  return (
    <svg
      viewBox="0 0 120 34"
      className={className}
      role="img"
      aria-label={title ?? (shipClass ? `${shipClass} hull silhouette` : "Ship hull silhouette")}
      style={{ filter: `drop-shadow(0 0 6px ${resolvedAccent}66)` }}
    >
      <g fill="none" stroke={resolvedAccent} strokeWidth="1.6" strokeLinejoin="round">
        {HULL_PATHS[resolvedKind].map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
