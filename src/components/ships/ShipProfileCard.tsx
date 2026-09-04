import {
  SHIP_ACCENT_HEX,
  getShipAccent,
  getShipCategory,
} from "@/lib/ships";
import { ShipSilhouette } from "./ShipSilhouette";

export interface ShipAssignmentData {
  shipClass?: string | null;
  shipRole?: string | null;
  shipGroup?: string | null;
  shipName?: string | null;
}

// ---------------------------------------------------------------------------
// Ship profile card — the canonical display of a pilot's assignment. The
// compact variant is the ship flair mini-card (silhouette + class + role +
// group) used on profile pages and dashboards.
// ---------------------------------------------------------------------------

export function ShipProfileCard({
  ship,
  compact = false,
  className,
}: {
  ship: ShipAssignmentData;
  compact?: boolean;
  className?: string;
}) {
  if (!ship.shipClass) return null;
  const accentHex = SHIP_ACCENT_HEX[getShipAccent(ship.shipClass)];
  const category = getShipCategory(ship.shipClass);

  if (compact) {
    return (
      <div
        className={
          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 " +
          "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.55)] " +
          (className ?? "")
        }
        title={`${ship.shipClass} — ${ship.shipRole ?? "Unassigned role"} · ${ship.shipGroup ?? "Unassigned group"}`}
      >
        <ShipSilhouette shipClass={ship.shipClass} className="h-5 w-16 shrink-0" />
        <span className="text-xs font-medium text-uf-text whitespace-nowrap">
          {ship.shipClass}
        </span>
        <span className="text-[10px] text-uf-muted whitespace-nowrap">
          {ship.shipRole ?? ""}
          {ship.shipRole && ship.shipGroup ? " · " : ""}
          {ship.shipGroup ?? ""}
        </span>
      </div>
    );
  }

  return (
    <div
      className={
        "relative overflow-hidden rounded-xl border border-[color:var(--uf-border)] " +
        "bg-[rgba(16,24,39,0.55)] backdrop-blur-sm p-4 " +
        (className ?? "")
      }
      style={{ boxShadow: `0 0 24px ${accentHex}22, inset 0 0 40px ${accentHex}0d` }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(320px 120px at 15% 0%, ${accentHex}14, transparent 70%)`,
        }}
      />
      <div className="relative">
        <span className="uf-eyebrow" style={{ color: accentHex }}>
          Ship assignment
        </span>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-xl font-semibold truncate">{ship.shipClass}</h3>
            <p className="text-uf-muted text-xs mt-0.5 truncate">
              {category ?? ""}
              {ship.shipName ? ` · “${ship.shipName}”` : ""}
            </p>
          </div>
          <ShipSilhouette shipClass={ship.shipClass} className="h-8 w-32 shrink-0" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ship.shipRole ? (
            <span className="rounded-full border border-[rgba(0,229,255,0.35)] bg-[rgba(0,229,255,0.08)] px-2.5 py-0.5 text-[11px] text-uf-cyan">
              {ship.shipRole}
            </span>
          ) : null}
          {ship.shipGroup ? (
            <span className="rounded-full border border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.1)] px-2.5 py-0.5 text-[11px] text-uf-violet">
              {ship.shipGroup}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}