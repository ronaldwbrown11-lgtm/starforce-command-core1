import { useCallback, useEffect, useMemo, useState } from "react";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import {
  AlertTriangle,
  ChevronRight,
  Database,
  Medal,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  UserRound,
} from "lucide-react";

/** True when a lore-library "database" item is the interactive personnel
 *  archive (native roster browser) rather than a plain subdomain embed. */
export function isPersonnelArchive(item: {
  title?: string | null;
  databaseName?: string | null;
  databaseUrl?: string | null;
  slug?: string | null;
}): boolean {
  const hay = `${item.title ?? ""} ${item.databaseName ?? ""} ${item.databaseUrl ?? ""} ${item.slug ?? ""}`
    .toLowerCase();
  return (
    hay.includes("personnel") ||
    hay.includes("roster") ||
    hay.includes("service record") ||
    hay.includes("dossier") ||
    hay.includes("canon character") ||
    hay.includes("records.php") ||
    hay.includes("service record manager")
  );
}

/** Hostinger SQL-backed personnel API — the Service Record Manager's
 *  records endpoint. Read straight from the browser; no proxy in between.
 *  `records.php` sends `Access-Control-Allow-Origin` for the site origin. */
const PERSONNEL_API_URL = "https://personnel.starforcebase1198.com/api/records.php";

/** Shape of a canon character record served by the Hostinger MySQL API. */
export type CanonPersonnel = {
  branch?: string;
  full_name?: string;
  service_num?: string;
  species?: string;
  dob?: string;
  height_build?: string;
  eyes_hair?: string;
  augmentation?: string;
  home_world?: string;
  assignment?: string;
  awards?: Array<{ name?: string; count?: number }>;
  weapons_manifest?: string;
  service_history?: string;
  commendations?: string;
  psych_profile?: string;
  rank?: string;
};

/** Fleet order — highest command first; unknown ranks sink to the bottom. */
const RANK_ORDER = [
  "Fleet Admiral",
  "Grand Admiral",
  "Admiral",
  "Vice Admiral",
  "Rear Admiral",
  "Captain",
  "Commander",
  "Lieutenant Commander",
  "Lieutenant",
  "Ensign",
  "Warrant Officer",
  "Master Chief",
  "Chief",
  "Petty Officer",
  "Sergeant",
  "Corporal",
  "Pilot",
  "Cadet",
  "Recruit",
  "Aspirant",
];

function rankIndex(rank: string | undefined): number {
  if (!rank) return RANK_ORDER.length + 1;
  const i = RANK_ORDER.indexOf(rank);
  return i === -1 ? RANK_ORDER.length + 2 : i;
}

function personName(p: CanonPersonnel): string {
  return p.full_name?.trim() || p.service_num?.trim() || "Unnamed";
}

export function PersonnelDossierBrowser() {
  const [records, setRecords] = useState<CanonPersonnel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(PERSONNEL_API_URL, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new Error(`Personnel database error (HTTP ${res.status}).`);
      }
      const data: unknown = await res.json();
      setRecords(Array.isArray(data) ? (data as CanonPersonnel[]) : []);
      setSelectedIndex(0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Personnel database unreachable.";
      setError(/fetch|network|cors|load/i.test(msg) ? `${msg} Check the Service Record Manager API.` : msg);
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
      const byRank = rankIndex(a.rank) - rankIndex(b.rank);
      if (byRank !== 0) return byRank;
      return personName(a).localeCompare(personName(b));
    });
  }, [records]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) =>
      [p.full_name, p.rank, p.branch, p.assignment, p.species, p.home_world, p.service_num]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [sorted, query]);

  const selected = filtered[selectedIndex] ?? filtered[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ---- Roster column ---- */}
      <section aria-label="Personnel roster" className="uf-panel flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[color:var(--uf-border)]">
          <p className="uf-eyebrow mb-2">Canon roster</p>
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
              placeholder="Search personnel…"
              aria-label="Search personnel"
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
              ? "No personnel records on file."
              : "No personnel records match."}
          </div>
        ) : (
          <ul className="list-none m-0 p-2 flex-1 overflow-y-auto lg:max-h-[62vh] flex flex-col gap-1">
            {filtered.map((p, i) => (
              <li key={`${p.service_num ?? ""}-${i}`}>
                <PersonnelRow
                  person={p}
                  active={selected === p}
                  onSelect={() => setSelectedIndex(i)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Dossier column ---- */}
      <section aria-label="Personnel file" className="min-w-0">
        {loading ? (
          <div className="uf-skeleton" style={{ height: 480 }} />
        ) : error ? (
          <HoloCard>
            <div className="uf-empty">
              <AlertTriangle className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
              Could not reach the personnel database.
            </div>
          </HoloCard>
        ) : selected ? (
          <PersonnelDossier key={personName(selected)} person={selected} />
        ) : (
          <HoloCard>
            <div className="uf-empty">
              <UserRound className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
              No personnel records on file yet.
            </div>
          </HoloCard>
        )}
      </section>

      <div aria-live="polite" className="sr-only">
        {selected ? `Personnel file open: ${personName(selected)}` : ""}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster row
// ---------------------------------------------------------------------------

function PersonnelRow({
  person,
  active,
  onSelect,
}: {
  person: CanonPersonnel;
  active: boolean;
  onSelect: () => void;
}) {
  const name = personName(person);
  const sub =
    [person.rank, person.assignment].filter(Boolean).join(" · ") ||
    person.branch ||
    "Unassigned";
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
      <InitialsAvatar name={name} size={36} />
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
// Textured personnel file card
// ---------------------------------------------------------------------------

function PersonnelDossier({ person }: { person: CanonPersonnel }) {
  const name = personName(person);
  const vitals = [
    { label: "Species", value: person.species },
    { label: "Home world", value: person.home_world },
    { label: "Date of birth", value: person.dob },
    { label: "Height / build", value: person.height_build },
    { label: "Eyes / hair", value: person.eyes_hair },
    { label: "Branch", value: person.branch },
  ].filter((v): v is { label: string; value: string } =>
    Boolean(v.value?.trim()),
  );
  const awards = (person.awards ?? []).filter((a) => a.name?.trim());
  const commendations = (person.commendations ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <article
      className="uf-dossier p-6 md:p-8"
      aria-label={`Personnel file: ${name}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <InitialsAvatar name={name} size={64} />
          <div className="min-w-0">
            <p className="uf-eyebrow mb-1">
              Personnel file
              {person.service_num ? ` · ${person.service_num}` : ""}
            </p>
            <h3 className="text-2xl font-semibold leading-tight break-words">{name}</h3>
            <p className="text-uf-muted text-sm mt-0.5">
              {person.rank ?? "Unassigned rank"}
              {person.assignment ? ` — ${person.assignment}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <StatusPill variant="gold">On file</StatusPill>
          <StatusPill variant="info">{person.branch ?? "Unassigned"}</StatusPill>
        </div>
      </header>

      {vitals.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-6 border-t border-[color:var(--uf-border)] pt-5">
          {vitals.map((v) => (
            <DossierStat key={v.label} label={v.label} value={v.value} />
          ))}
        </dl>
      ) : null}

      {person.augmentation?.trim() ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Augmentation
          </h4>
          <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90">
            {person.augmentation}
          </p>
        </section>
      ) : null}

      {person.weapons_manifest?.trim() ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan flex items-center gap-2 mb-2">
            <Shield className="h-3.5 w-3.5" aria-hidden />
            Weapons manifest
          </h4>
          <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90">
            {person.weapons_manifest}
          </p>
        </section>
      ) : null}

      {person.service_history?.trim() ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan flex items-center gap-2 mb-2">
            <UserRound className="h-3.5 w-3.5" aria-hidden />
            Service history
          </h4>
          <p className="text-sm leading-relaxed text-[color:var(--uf-text)]/90 whitespace-pre-wrap">
            {person.service_history}
          </p>
        </section>
      ) : null}

      {awards.length > 0 ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan flex items-center gap-2 mb-2">
            <Medal className="h-3.5 w-3.5" aria-hidden />
            Awards
          </h4>
          <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
            {awards.map((a, i) => (
              <li key={`${a.name}-${i}`}>
                <StatusPill variant="gold">
                  {a.name}
                  {typeof a.count === "number" && a.count > 1 ? ` ×${a.count}` : ""}
                </StatusPill>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {commendations.length > 0 ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan flex items-center gap-2 mb-2">
            <Medal className="h-3.5 w-3.5" aria-hidden />
            Commendations
          </h4>
          <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
            {commendations.map((c) => (
              <li key={c}>
                <StatusPill variant="info">{c}</StatusPill>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {person.psych_profile?.trim() ? (
        <section className="mt-6">
          <h4 className="text-xs uppercase tracking-[0.16em] text-uf-cyan flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Psych profile
          </h4>
          <p className="text-sm italic leading-relaxed text-[color:var(--uf-text)]/85 border-l-2 border-[color:var(--uf-cyan)]/40 pl-3">
            {person.psych_profile}
          </p>
        </section>
      ) : null}

      <footer className="mt-6 border-t border-[color:var(--uf-border)] pt-4">
        <p className="text-xs text-uf-muted">
          Source: Service Record Manager · Sector 1198 command archive
        </p>
      </footer>
    </article>
  );
}

function DossierStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.16em] text-uf-muted">{label}</dt>
      <dd className="mt-1 text-base font-semibold break-words">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Initials avatar (canon characters have no portrait uploads yet)
// ---------------------------------------------------------------------------

function InitialsAvatar({ name, size }: { name: string; size: number }) {
  const initials = (name.charAt(0) || "?").toUpperCase();
  return (
    <span
      aria-hidden
      className="rounded-full grid place-items-center overflow-hidden shrink-0"
      style={{
        width: size,
        height: size,
        background:
          "conic-gradient(from 220deg, var(--uf-cyan), var(--uf-violet), var(--uf-magenta), var(--uf-cyan))",
        boxShadow: "0 0 12px rgba(0,229,255,0.25)",
      }}
    >
      <span
        style={{
          background: "var(--uf-void)",
          color: "var(--uf-text)",
          width: size - 6,
          height: size - 6,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: Math.round(size * 0.38),
        }}
      >
        {initials}
      </span>
    </span>
  );
}
