import { useCallback, useEffect, useMemo, useState } from "react";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import {
  AlertTriangle,
  ChevronRight,
  Crosshair,
  Database,
  RefreshCw,
  Search,
  Shield,
  Target,
} from "lucide-react";

/** True when a lore-library "database" item is the canon Armory (arsenal
 *  manifest) — rendered as a native weapons browser fed by the Hostinger
 *  armory API, the same way the personnel archive is. */
export function isArmoryArchive(item: {
  title?: string | null;
  databaseName?: string | null;
  databaseUrl?: string | null;
  slug?: string | null;
}): boolean {
  const hay = `${item.title ?? ""} ${item.databaseName ?? ""} ${item.databaseUrl ?? ""} ${item.slug ?? ""}`
    .toLowerCase();
  return (
    hay.includes("armory") ||
    hay.includes("arsenal") ||
    hay.includes("weapon") ||
    hay.includes("armory.starforcebase1198.com")
  );
}

/** Shape of a canon weapon record served by the Hostinger armory API. */
export type CanonWeapon = {
  id?: string;
  designation?: string;
  category?: string;
  builder?: string;
  registryNumber?: string;
  status?: string;
  fleet?: string;
  range?: string;
  rof?: string;
  primarySpec?: string;
};

/** Hostinger SQL-backed armory API — the Armory subdomain's existing
 *  weapons.php endpoint (config.php + weapons.php + MySQL). Read straight
 *  from the browser; needs the Access-Control-Allow-Origin header set in
 *  weapons.php, the same one-line fix as personnel's records.php. */
const ARMORY_API_URL = "https://armory.starforcebase1198.com/weapons.php";

function s(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function ArmoryBrowser() {
  const [records, setRecords] = useState<CanonWeapon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ARMORY_API_URL, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Armory database error (HTTP ${res.status}).`);
      }
      const data: unknown = await res.json();
      const raw = Array.isArray(data)
        ? data
        : (data as { records?: unknown } | null)?.records;
      const mapped: CanonWeapon[] = Array.isArray(raw)
        ? (raw as Record<string, unknown>[]).map((w) => ({
            id: s(w.id),
            designation: s(w.designation),
            category: s(w.category),
            builder: s(w.builder),
            registryNumber: s(w.registry_number) ?? s(w.registryNumber),
            status: s(w.status),
            fleet: s(w.fleet),
            range: s(w.effective_range) ?? s(w.range),
            rof: s(w.rate_of_fire) ?? s(w.rof),
            primarySpec: s(w.primary_spec) ?? s(w.primarySpec),
          }))
        : [];
      setRecords(mapped);
      setSelectedIndex(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Armory database unreachable.";
      setError(/fetch|network|cors|load/i.test(msg) ? `${msg} Check the armory API.` : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    if (!records) return [];
    return [...records].sort((a, b) => {
      const byCat = (a.category ?? "").localeCompare(b.category ?? "");
      if (byCat !== 0) return byCat;
      return (a.designation ?? "").localeCompare(b.designation ?? "");
    });
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((w) =>
      [w.designation, w.category, w.builder, w.registryNumber, w.status]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [sorted, query]);

  const selected = filtered[selectedIndex] ?? filtered[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ---- Arsenal list column ---- */}
      <section aria-label="Arsenal manifest" className="uf-panel flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[color:var(--uf-border)]">
          <p className="uf-eyebrow mb-2">Arsenal manifest</p>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-uf-muted"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search weapons…"
              aria-label="Search weapons"
              className="w-full border border-[color:var(--uf-border)] rounded-md pl-9 pr-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-4 flex flex-col gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 60 }} />
            ))}
          </div>
        ) : error ? (
          <div className="uf-empty p-6 text-left">
            <Database className="h-7 w-7 mx-auto mb-3 opacity-60" aria-hidden />
            {error}
            <div className="mt-4 flex justify-center">
              <NeonButton variant="primary" onClick={() => void load()}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                Retry
              </NeonButton>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="uf-empty p-6">
            {records && records.length === 0
              ? "No weapons on file."
              : "No weapons match."}
          </div>
        ) : (
          <ul className="list-none m-0 p-2 flex-1 overflow-y-auto lg:max-h-[62vh] flex flex-col gap-1">
            {filtered.map((w, i) => (
              <li key={`${w.id ?? ""}-${i}`}>
                <WeaponRow
                  weapon={w}
                  active={selected === w}
                  onSelect={() => setSelectedIndex(i)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Weapon file column ---- */}
      <section aria-label="Weapon file" className="min-w-0">
        {loading ? (
          <div className="uf-skeleton" style={{ height: 480 }} />
        ) : error ? (
          <HoloCard>
            <div className="uf-empty">
              <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
              Could not reach the armory database.
            </div>
          </HoloCard>
        ) : selected ? (
          <WeaponDossier key={selected.id ?? selected.designation ?? "w"} weapon={selected} />
        ) : (
          <HoloCard>
            <div className="uf-empty">
              <Crosshair className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
              No weapons on file yet.
            </div>
          </HoloCard>
        )}
      </section>

      <div aria-live="polite" className="sr-only">
        {selected ? `Weapon file open: ${selected.designation}` : ""}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arsenal row
// ---------------------------------------------------------------------------

function WeaponRow({
  weapon,
  active,
  onSelect,
}: {
  weapon: CanonWeapon;
  active: boolean;
  onSelect: () => void;
}) {
  const name = weapon.designation || weapon.registryNumber || "Unregistered";
  const sub = weapon.category || "Unclassified";
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
        className="h-9 w-9 rounded-md shrink-0 grid place-items-center"
        style={{
          background: "linear-gradient(135deg, rgba(255,179,0,0.16), rgba(0,229,255,0.10))",
          border: "1px solid rgba(255,179,0,0.35)",
          color: "var(--uf-amber, #ffd54f)",
        }}
      >
        <Target className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold truncate">{name}</span>
        <span className="block text-xs text-uf-muted truncate">{sub}</span>
      </span>
      <ChevronRight
        className={`h-4 w-4 shrink-0 ${active ? "text-uf-cyan" : "text-uf-muted"}`}
        aria-hidden
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Weapon file card
// ---------------------------------------------------------------------------

function WeaponDossier({ weapon }: { weapon: CanonWeapon }) {
  const name = weapon.designation || weapon.registryNumber || "Unregistered";
  const specs = [
    { label: "Registry", value: weapon.registryNumber },
    { label: "Class", value: weapon.category },
    { label: "Status", value: weapon.status },
    { label: "Builder", value: weapon.builder },
    { label: "Ammunition cell", value: weapon.fleet },
    { label: "Effective range", value: weapon.range },
    { label: "Rate of fire", value: weapon.rof },
  ].filter((v): v is { label: string; value: string } => Boolean(v.value?.trim()));

  return (
    <article className="uf-dossier p-6 md:p-8" aria-label={`Weapon file: ${name}`}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span
            aria-hidden
            className="h-16 w-16 rounded-xl grid place-items-center shrink-0"
            style={{
              background: "linear-gradient(135deg, rgba(255,179,0,0.18), rgba(122,43,217,0.18))",
              border: "1px solid rgba(255,179,0,0.4)",
              color: "var(--uf-amber, #ffd54f)",
              boxShadow: "0 0 16px rgba(255,179,0,0.18)",
            }}
          >
            <Crosshair className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <p className="uf-eyebrow mb-1">
              Weapon file
              {weapon.registryNumber ? ` · ${weapon.registryNumber}` : ""}
            </p>
            <h3 className="text-2xl font-semibold leading-tight break-words">{name}</h3>
            <p className="text-uf-muted text-sm mt-0.5">{weapon.category ?? "Unclassified"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <StatusPill variant="gold">
            {(weapon.status ?? "Active").toUpperCase()}
          </StatusPill>
          <StatusPill variant="info">Ordnance</StatusPill>
        </div>
      </header>

      {specs.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-6 border-t border-[color:var(--uf-border)] pt-5">
          {specs.map((s) => (
            <div key={s.label}>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-uf-muted">{s.label}</dt>
              <dd className="mt-1 text-base font-semibold break-words">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {weapon.primarySpec?.trim() ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan flex items-center gap-2 mb-2">
            <Shield className="h-3.5 w-3.5" aria-hidden />
            Primary specification
          </h4>
          <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90">
            {weapon.primarySpec}
          </p>
        </section>
      ) : null}

      <footer className="mt-6 border-t border-[color:var(--uf-border)] pt-4">
        <p className="text-xs text-uf-muted">
          Source: STAR FORCE ARMORY · Sector 1198 arsenal manifest
        </p>
      </footer>
    </article>
  );
}
