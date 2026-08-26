import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard, StatusPill } from "@/components/uf";
import {
  AlertTriangle,
  ChevronRight,
  Database,
  RefreshCw,
  Search,
  Ship,
  Shield,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Badge → color mapping
// ---------------------------------------------------------------------------

const BADGE_COLORS: Record<string, { bg: string; border: string; fg: string }> = {
  FLAGSHIP:     { bg: "rgba(255,215,0,0.18)",   border: "rgba(255,215,0,0.45)",    fg: "#ffd700" },
  CARRIER:      { bg: "rgba(0,229,255,0.15)",    border: "rgba(0,229,255,0.40)",    fg: "#00e5ff" },
  DREADNAUGHT:  { bg: "rgba(255,82,82,0.18)",    border: "rgba(255,82,82,0.45)",    fg: "#ff5252" },
  BATTLESHIP:   { bg: "rgba(255,152,0,0.18)",    border: "rgba(255,152,0,0.45)",    fg: "#ff9800" },
  DESTROYER:    { bg: "rgba(233,30,99,0.18)",    border: "rgba(233,30,99,0.40)",    fg: "#e91e63" },
  TRANSPORT:    { bg: "rgba(76,175,80,0.18)",    border: "rgba(76,175,80,0.40)",    fg: "#4caf50" },
  ESCORT:       { bg: "rgba(121,134,203,0.18)",  border: "rgba(121,134,203,0.40)",  fg: "#7986cb" },
  SUPPRESSION:  { bg: "rgba(156,39,176,0.18)",   border: "rgba(156,39,176,0.40)",   fg: "#9c27b0" },
  DRONE:        { bg: "rgba(0,230,118,0.18)",    border: "rgba(0,230,118,0.40)",    fg: "#00e676" },
  STEALTH:      { bg: "rgba(38,198,218,0.18)",   border: "rgba(38,198,218,0.40)",   fg: "#26c6da" },
  MEDICAL:      { bg: "rgba(255,255,255,0.12)",  border: "rgba(255,255,255,0.30)",  fg: "#e0e0e0" },
  INDUSTRIAL:   { bg: "rgba(255,183,77,0.18)",   border: "rgba(255,183,77,0.40)",   fg: "#ffb74d" },
  STRIKE:       { bg: "rgba(255,112,67,0.18)",   border: "rgba(255,112,67,0.40)",   fg: "#ff7043" },
  INTERCEPTOR:  { bg: "rgba(100,181,246,0.18)",  border: "rgba(100,181,246,0.40)",  fg: "#64b5f6" },
  FIGHTER:      { bg: "rgba(129,199,132,0.18)",  border: "rgba(129,199,132,0.40)",  fg: "#81c784" },
  CORVETTE:     { bg: "rgba(186,156,255,0.18)",  border: "rgba(186,156,255,0.40)",  fg: "#ba9cff" },
  FRIGATE:      { bg: "rgba(255,213,79,0.18)",   border: "rgba(255,213,79,0.40)",   fg: "#ffd54f" },
};

function badgeStyle(badge: string) {
  return BADGE_COLORS[badge.toUpperCase()] ?? { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.25)", fg: "#ccc" };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FleetBrowser() {
  const vessels = useQuery(api.vessels.listAll);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [badgeFilter, setBadgeFilter] = useState("");

  const error = vessels === undefined ? null : null;

  // Collect unique badges for the filter chips
  const badges = useMemo(() => {
    if (!vessels) return [];
    const set = new Set<string>();
    for (const v of vessels) if (v.badge) set.add(v.badge.toUpperCase());
    return [...set].sort();
  }, [vessels]);

  const filtered = useMemo(() => {
    const all = vessels ?? [];
    let result = all;
    if (badgeFilter) {
      result = result.filter((v) => v.badge?.toUpperCase() === badgeFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return result;
    return result.filter((v) =>
      [v.designation, v.name, v.badge, v.shipClass, v.registry, v.role, v.fleet]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(q)),
    );
  }, [vessels, query, badgeFilter]);

  const selected = filtered[selectedIndex] ?? filtered[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ---- Sidebar: vessel list ---- */}
      <section aria-label="Fleet registry list" className="uf-panel flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[color:var(--uf-border)]">
          <p className="uf-eyebrow mb-2">Fleet registry</p>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-uf-muted"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              placeholder="Search vessels…"
              aria-label="Search vessels"
              className="w-full border border-[color:var(--uf-border)] rounded-md pl-9 pr-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </div>

          {/* Badge filter chips */}
          <div className="flex flex-wrap gap-1.5 mt-3" role="group" aria-label="Filter by badge">
            <button
              type="button"
              onClick={() => setBadgeFilter("")}
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border transition-colors ${
                !badgeFilter
                  ? "border-[color:var(--uf-cyan)] bg-[rgba(0,229,255,0.12)] text-[var(--uf-cyan)]"
                  : "border-[color:var(--uf-border)] text-uf-muted hover:border-[color:var(--uf-cyan)]/50"
              }`}
            >
              All
            </button>
            {badges.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => { setBadgeFilter(b === badgeFilter ? "" : b); setSelectedIndex(0); }}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider border transition-colors ${
                  badgeFilter === b
                    ? "border-[color:var(--uf-cyan)] bg-[rgba(0,229,255,0.12)] text-[var(--uf-cyan)]"
                    : "border-[color:var(--uf-border)] text-uf-muted hover:border-[color:var(--uf-cyan)]/50"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {vessels === undefined ? (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 60 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="uf-empty p-6">
            <Database className="h-7 w-7 mx-auto mb-3 opacity-60" aria-hidden />
            {query || badgeFilter ? "No vessels match your filters." : "No vessels in the registry."}
          </div>
        ) : (
          <ul className="list-none m-0 p-2 flex-1 overflow-y-auto lg:max-h-[62vh] flex flex-col gap-1">
            {filtered.map((v, i) => (
              <li key={v._id}>
                <VesselRow vessel={v} active={selected?._id === v._id} onSelect={() => setSelectedIndex(i)} />
              </li>
            ))}
          </ul>
        )}

        {vessels !== undefined && (
          <div className="px-4 py-2 border-t border-[color:var(--uf-border)] text-xs text-uf-muted">
            {filtered.length} vessel{filtered.length !== 1 ? "s" : ""}
            {badgeFilter ? ` · filtered by ${badgeFilter}` : ""}
          </div>
        )}
      </section>

      {/* ---- Main: vessel dossier ---- */}
      <section aria-label="Vessel file" className="min-w-0">
        {vessels === undefined ? (
          <div className="uf-skeleton" style={{ height: 480 }} />
        ) : error ? (
          <HoloCard>
            <div className="uf-empty">
              <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
              Could not load the fleet database.
            </div>
          </HoloCard>
        ) : selected ? (
          <VesselDossier key={selected._id} vessel={selected} />
        ) : (
          <HoloCard>
            <div className="uf-empty">
              <Ship className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
              No vessels on file yet.
            </div>
          </HoloCard>
        )}
      </section>

      <div aria-live="polite" className="sr-only">
        {selected ? `Vessel file open: ${selected.name}` : ""}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vessel row
// ---------------------------------------------------------------------------

function VesselRow({
  vessel,
  active,
  onSelect,
}: {
  vessel: any;
  active: boolean;
  onSelect: () => void;
}) {
  const style = badgeStyle(vessel.badge ?? "");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        active
          ? "border-[rgba(0,229,255,0.5)] bg-[rgba(0,229,255,0.08)]"
          : "border-transparent hover:border-[color:var(--uf-border)] hover:bg-[rgba(16,24,39,0.45)]"
      }`}
    >
      <span
        aria-hidden
        className="h-9 w-9 rounded-md shrink-0 grid place-items-center text-xs font-bold"
        style={{ background: style.bg, border: `1px solid ${style.border}`, color: style.fg }}
      >
        <Ship className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate">{vessel.name}</span>
        <span className="block text-xs text-uf-muted truncate">
          {vessel.badge} · {vessel.designation}
        </span>
      </span>
      <ChevronRight
        className={`h-4 w-4 shrink-0 ${active ? "text-uf-cyan" : "text-uf-muted"}`}
        aria-hidden
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Vessel dossier card
// ---------------------------------------------------------------------------

function VesselDossier({ vessel }: { vessel: any }) {
  const style = badgeStyle(vessel.badge ?? "");

  const specs = [
    { label: "Registry", value: vessel.registry },
    { label: "Class", value: vessel.shipClass },
    { label: "Status", value: vessel.status },
    { label: "Fleet", value: vessel.fleet },
    { label: "Builder", value: vessel.builder },
    { label: "Commissioned", value: vessel.commissionDate },
    { label: "Crew", value: vessel.crew },
    { label: "Hull length", value: vessel.hullLength ? `${vessel.hullLength}m` : undefined },
    { label: "Hull width", value: vessel.hullWidth ? `${vessel.hullWidth}m` : undefined },
    { label: "Decks", value: vessel.decks },
    { label: "Weight", value: vessel.weight },
    { label: "Acceleration", value: vessel.acceleration },
    { label: "Propulsion", value: vessel.propulsion },
    { label: "Armor", value: vessel.armor },
    { label: "Maneuverability", value: vessel.maneuverability },
    { label: "Computer", value: vessel.computer },
  ].filter((s): s is { label: string; value: string } => Boolean(s.value?.trim()));

  return (
    <article className="uf-dossier p-6 md:p-8" aria-label={`Vessel file: ${vessel.name}`}>
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span
            aria-hidden
            className="h-16 w-16 rounded-xl grid place-items-center shrink-0"
            style={{
              background: style.bg,
              border: `1px solid ${style.border}`,
              color: style.fg,
              boxShadow: `0 0 16px ${style.border}`,
            }}
          >
            <Ship className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <p className="uf-eyebrow mb-1">
              Vessel file
              {vessel.designation ? ` · ${vessel.designation}` : ""}
            </p>
            <h3 className="text-2xl font-semibold leading-tight break-words">{vessel.name}</h3>
            <p className="text-uf-muted text-sm mt-0.5">{vessel.badge}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <StatusPill variant="info">{(vessel.status ?? "Active").toUpperCase()}</StatusPill>
          <StatusPill variant="gold">{vessel.badge}</StatusPill>
        </div>
      </header>

      {/* Role */}
      {vessel.role?.trim() ? (
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--uf-text)]/80 border-b border-[color:var(--uf-border)] pb-4">
          {vessel.role}
        </p>
      ) : null}

      {/* Specifications grid */}
      {specs.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-5">
          {specs.map((s) => (
            <div key={s.label}>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-uf-muted">{s.label}</dt>
              <dd className="mt-1 text-sm font-semibold break-words">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* Armament */}
      {(vessel.armament?.trim() || vessel.primaryArmament?.trim()) ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan flex items-center gap-2 mb-2">
            <Shield className="h-3.5 w-3.5" aria-hidden />
            Armament
          </h4>
          {vessel.primaryArmament?.trim() ? (
            <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90">
              <span className="font-semibold">Primary:</span> {vessel.primaryArmament}
            </p>
          ) : null}
          {vessel.secondaryArmament?.trim() ? (
            <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90 mt-1">
              <span className="font-semibold">Secondary:</span> {vessel.secondaryArmament}
            </p>
          ) : null}
          {vessel.defensiveSystems?.trim() ? (
            <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90 mt-1">
              <span className="font-semibold">Defensive:</span> {vessel.defensiveSystems}
            </p>
          ) : null}
          {vessel.armament?.trim() && !vessel.primaryArmament?.trim() ? (
            <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90">
              {vessel.armament}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Capabilities */}
      {vessel.capabilities?.trim() ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan mb-2">Capabilities</h4>
          <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90">{vessel.capabilities}</p>
        </section>
      ) : null}

      {/* Notes */}
      {vessel.notes?.trim() ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan mb-2">Operational notes</h4>
          <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90">{vessel.notes}</p>
        </section>
      ) : null}

      {/* Variants */}
      {vessel.variants?.trim() ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan mb-2">Known variants</h4>
          <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90">{vessel.variants}</p>
        </section>
      ) : null}

      <footer className="mt-6 border-t border-[color:var(--uf-border)] pt-4">
        <p className="text-xs text-uf-muted">
          Source: STAR FORCE FLEET COMMAND · Sector 1198 vessel registry
          {vessel.classified ? " · CLASSIFIED" : ""}
        </p>
      </footer>
    </article>
  );
}
