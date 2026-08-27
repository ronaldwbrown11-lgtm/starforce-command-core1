import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link, useSearchParams } from "react-router";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { ScaleReveal } from "@/hooks/use-scroll-reveal";
import { LoreScanner } from "@/components/widgets/LoreScanner";
import { GalaxyMapMini } from "@/components/widgets/GalaxyMapMini";
import { isPersonnelArchive } from "@/components/widgets/PersonnelDossierBrowser";
import { isArmoryArchive } from "@/components/widgets/ArmoryBrowser";
import { BookOpenText, ChevronRight, Database, FileText, ImageIcon, PenLine } from "lucide-react";

import { usePageMeta } from "@/hooks/use-page-meta";
type Tab = "bibles" | "images" | "databases" | "entries";

const TABS: Array<{ id: Tab; label: string; icon: typeof BookOpenText }> = [
  { id: "bibles", label: "Lore Bibles", icon: BookOpenText },
  { id: "images", label: "Lore Images", icon: ImageIcon },
  { id: "databases", label: "Lore Databases", icon: Database },
  { id: "entries", label: "Entries", icon: FileText },
];

export default function Lore() {
  const [tab, setTab] = useState<Tab>("bibles");
  const [faction, setFaction] = useState("");
  const [sector, setSector] = useState("");
  const [classification, setClassification] = useState("");
  const [entryType, setEntryType] = useState("");
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const s = searchParams.get("sector");
    if (s) setSector(s);
    const t = searchParams.get("tab");
    if (t === "bibles" || t === "images" || t === "databases" || t === "entries") {
      setTab(t);
    }
  }, [searchParams]);

  const library = useQuery(api.loreLibrary.listLoreLibrary, { limit: 200 });
  const entries = useQuery(api.content.listLore, {
    limit: 60,
    faction: faction || undefined,
    sector: sector || undefined,
    classification: classification || undefined,
    entryType: entryType || undefined,
  });

  const bibles = useMemo(
    () => (library ?? []).filter((i) => i.loreType === "bible"),
    [library],
  );
  const images = useMemo(
    () => (library ?? []).filter((i) => i.loreType === "image"),
    [library],
  );
  const databases = useMemo(
    () => (library ?? []).filter((i) => i.loreType === "database"),
    [library],
  );

  const factions = useMemo(() => {
    if (!entries) return [];
    return Array.from(
      new Set(entries.map((e) => e.faction).filter((f): f is string => !!f)),
    );
  }, [entries]);
  const sectors = useMemo(() => {
    if (!entries) return [];
    return Array.from(
      new Set(entries.map((e) => e.sector).filter((s): s is string => !!s)),
    );
  }, [entries]);
  usePageMeta({ title: "Lore Archive — Star Force Base 1198", description: "Explore the canonical lore of the Star Force universe — factions, sectors, discoveries.", noindex: false });


  return (
    <SiteShell>
      <PageHero
        eyebrow="Lore Library"
        title="The Records of Sector 1198"
        lead="Lore bibles, image plates, and live databases — plus the cross-referenced entry archive. Everything canonical, in one vault."
        primary={{ label: "Submit lore", href: "/lore/submit", variant: "primary" }}
        secondary={{ label: "Browse the archive", href: "#lore-archive", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div
          className="flex gap-2 mb-8 flex-wrap"
          role="tablist"
          aria-label="Lore library sections"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`uf-btn ${tab === t.id ? "uf-btn--primary" : ""}`}
            >
              <t.icon className="h-4 w-4" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>


        {tab === "bibles" ? <BibleGrid items={bibles} loading={library === undefined} /> : null}
        {tab === "images" ? <ImageGrid items={images} loading={library === undefined} /> : null}
        {tab === "databases" ? <DatabasePanel items={databases} loading={library === undefined} /> : null}
        {tab === "entries" ? (
          <EntriesGrid
            entries={entries}
            factions={factions}
            sectors={sectors}
            faction={faction}
            sector={sector}
            classification={classification}
            entryType={entryType}
            setFaction={setFaction}
            setSector={setSector}
            setClassification={setClassification}          setEntryType={setEntryType}
        />
        ) : null}

        <div className="uf-grid uf-grid--3 gap-6 mt-10">
          <HoloCard className="col-span-2">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="uf-eyebrow">The vault</span>
                <h2 className="text-2xl font-semibold mt-2">
                  Everything the fleet knows.
                </h2>
                <p className="text-uf-muted text-sm mt-2 max-w-xl">
                  Bibles carry the operating canon as documents. Image plates
                  are the deep-field archives. Databases are embedded from
                  their subdomains and queried live. Members can submit new
                  lore for operator approval from their own pages.
                </p>
              </div>
              <div className="flex flex-col gap-2 items-stretch sm:items-end shrink-0">
                <Link to="/lore/submit" className="block">
                  <NeonButton variant="primary">
                    <PenLine className="h-4 w-4" aria-hidden />
                    Submit lore
                  </NeonButton>
                </Link>
                <Link to="/stories" className="block">
                  <NeonButton variant="ghost">Submit a story</NeonButton>
                </Link>
              </div>
            </div>
          </HoloCard>
          <HoloCard>
            <span className="uf-eyebrow">Sector chart</span>
            <GalaxyMapMini />
          </HoloCard>
        </div>
      </section>
    </SiteShell>
  );
}

// -------------------------------------------------------------------------
// Bibles
// -------------------------------------------------------------------------

function BibleGrid({ items, loading }: { items: any[]; loading: boolean }) {
  return (
    <section id="lore-archive" aria-label="Lore bibles">
      <header className="mb-6">
        <span className="uf-eyebrow">Bibles</span>
        <h2 className="text-2xl font-semibold mt-2">
          {loading ? "Loading the canon…" : `${items.length} bible${items.length === 1 ? "" : "s"} on file.`}
        </h2>
      </header>
      {!loading && items.length === 0 ? (
        <div className="uf-empty">No approved lore bibles yet. Operators can upload them from the console.</div>
      ) : (
        <div className="uf-grid uf-grid--3">
          {items.map((b, idx) => (
            <Link key={b._id} to={`/lore/${b.slug}`} className="block">
              <ScaleReveal staggerIndex={idx}>
                <HoloCard>
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className="h-11 w-11 rounded-md flex items-center justify-center shrink-0"
                      style={{
                        background: "linear-gradient(135deg, rgba(0,229,255,0.16), rgba(122,43,217,0.16))",
                        border: "1px solid rgba(0,229,255,0.35)",
                        color: "var(--uf-cyan)",
                      }}
                    >
                      <BookOpenText className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold truncate">{b.title}</h3>
                      <p className="text-uf-muted text-xs truncate">
                        {b.fileMeta?.fileName ?? "Document pending upload"}
                      </p>
                    </div>
                  </div>
                  <p className="text-uf-muted text-sm line-clamp-3">{b.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {b.faction ? <StatusPill variant="info">{b.faction}</StatusPill> : null}
                    {b.sector ? <StatusPill variant="violet">{b.sector}</StatusPill> : null}
                    {b.classification ? (
                      <StatusPill variant="warning">{b.classification}</StatusPill>
                    ) : null}
                  </div>
                </HoloCard>
              </ScaleReveal>
            </Link>
          ))}
          {loading && [0, 1, 2].map((i) => (
            <div key={i} className="uf-skeleton" style={{ height: 180 }} />
          ))}
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------------------
// Images
// -------------------------------------------------------------------------

function ImageGrid({ items, loading }: { items: any[]; loading: boolean }) {
  return (
    <section id="lore-archive" aria-label="Lore image plates">
      <header className="mb-6">
        <span className="uf-eyebrow">Image plates</span>
        <h2 className="text-2xl font-semibold mt-2">
          {loading ? "Loading plates…" : `${items.length} deep-field plate${items.length === 1 ? "" : "s"}.`}
        </h2>
      </header>
      {!loading && items.length === 0 ? (
        <div className="uf-empty">No approved lore images yet.</div>
      ) : (
        <div className="uf-grid uf-grid--3">
          {items.map((img, idx) => (
            <Link key={img._id} to={`/lore/${img.slug}`} className="block">
              <ScaleReveal staggerIndex={idx}>
                <HoloCard className="p-0 overflow-hidden">
                  <div
                    className="h-44 w-full bg-cover bg-center"
                    style={{
                      backgroundImage: img.coverUrl ? `url(${img.coverUrl})` : undefined,
                      background: img.coverUrl
                        ? undefined
                        : "linear-gradient(135deg, var(--uf-void), #12284d)",
                    }}
                    role="img"
                    aria-label={img.title}
                  />
                  <div className="p-4">
                    <h3 className="text-lg font-semibold">{img.title}</h3>
                    <p className="text-uf-muted text-sm mt-1 line-clamp-2">{img.description}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {img.faction ? <StatusPill variant="info">{img.faction}</StatusPill> : null}
                      {img.classification ? (
                        <StatusPill variant="warning">{img.classification}</StatusPill>
                      ) : null}
                    </div>
                  </div>
                </HoloCard>
              </ScaleReveal>
            </Link>
          ))}
          {loading && [0, 1, 2].map((i) => (
            <div key={i} className="uf-skeleton" style={{ height: 220 }} />
          ))}
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------------------
// Databases
// -------------------------------------------------------------------------

function DatabasePanel({ items, loading }: { items: any[]; loading: boolean }) {
  return (
    <section id="lore-archive" aria-label="Lore databases">
      <header className="mb-6">
        <span className="uf-eyebrow">Live databases</span>
        <h2 className="text-2xl font-semibold mt-2">
          {loading
            ? "Contacting subdomains…"
            : `${items.length} database${items.length === 1 ? "" : "s"} on the net.`}
        </h2>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Each canon database lives on its own page and is queried live from
          its subdomain. Open a card to access the archive.
        </p>
      </header>
      {!loading && items.length === 0 ? (
        <div className="uf-empty">No lore databases deployed yet.</div>
      ) : (
        <div className="uf-grid uf-grid--3">
          {items.map((db, idx) => {
            const isPersonnel = isPersonnelArchive(db);
            const isArmory = isArmoryArchive(db);
            const kind = isPersonnel
              ? "Personnel roster"
              : isArmory
                ? "Arsenal manifest"
                : "Embedded";
            return (
              <Link key={db._id} to={`/lore/databases/${db.slug}`} className="block">
                <ScaleReveal staggerIndex={idx}>
                  <HoloCard>
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className="h-11 w-11 rounded-md flex items-center justify-center shrink-0"
                        style={{
                          background:
                            isPersonnel || isArmory
                              ? "linear-gradient(135deg, rgba(0,229,255,0.14), rgba(255,179,0,0.14))"
                              : "rgba(0,229,255,0.08)",
                          border: "1px solid rgba(0,229,255,0.35)",
                          color: "var(--uf-cyan)",
                        }}
                      >
                        <Database className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold truncate">{db.title}</h3>
                        <p className="text-uf-muted text-xs truncate">
                          {db.databaseName ?? "Database"}
                          {db.databaseUrl ? ` · ${db.databaseUrl}` : ""}
                        </p>
                      </div>
                    </div>
                    <p className="text-uf-muted text-sm line-clamp-3">{db.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-4">
                      {db.faction ? <StatusPill variant="info">{db.faction}</StatusPill> : null}
                      <StatusPill variant={isArmory ? "gold" : "info"}>{kind}</StatusPill>
                      <span className="ml-auto inline-flex items-center gap-1 text-xs uppercase tracking-[0.14em] text-uf-muted">
                        Open
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </div>
                  </HoloCard>
                </ScaleReveal>
              </Link>
            );
          })}
          {loading && [0, 1, 2].map((i) => (
            <div key={i} className="uf-skeleton" style={{ height: 180 }} />
          ))}
        </div>
      )}
    </section>
  );
}

// -------------------------------------------------------------------------
// Text entries (existing archive)
// -------------------------------------------------------------------------

function EntriesGrid({
  entries,
  factions,
  sectors,
  faction,
  sector,
  classification,
  entryType,
  setFaction,
  setSector,
  setClassification,
  setEntryType,
}: {
  entries: any[] | undefined;
  factions: string[];
  sectors: string[];
  faction: string;
  sector: string;
  classification: string;
  entryType: string;
  setFaction: (v: string) => void;
  setSector: (v: string) => void;
  setClassification: (v: string) => void;
  setEntryType: (v: string) => void;
}) {
  return (
    <section id="lore-archive" aria-label="Lore entry archive">
      <div className="uf-grid uf-grid--2 gap-6 mb-6">
        <div>
          <span className="uf-eyebrow">Lore scanner</span>
          <LoreScanner />
        </div>
        <div className="uf-card">
          <div className="grid sm:grid-cols-2 gap-3">
            <FilterSelect label="Faction" value={faction} options={factions} onChange={setFaction} />
            <FilterSelect label="Sector" value={sector} options={sectors} onChange={setSector} />
            <FilterSelect
              label="Classification"
              value={classification}
              options={["open", "restricted"]}
              onChange={setClassification}
            />
            <FilterSelect
              label="Entry type"
              value={entryType}
              options={["location", "character", "event", "artifact"]}
              onChange={setEntryType}
            />
          </div>
        </div>
      </div>
      <header className="mb-6">
        <span className="uf-eyebrow">Archive</span>
        <h2 className="text-2xl font-semibold mt-2">
          {entries === undefined ? "Loading archive…" : `${entries.length} entries match.`}
        </h2>
      </header>
      {entries && entries.length === 0 ? (
        <div className="uf-empty">No archives match. Adjust filters.</div>
      ) : (
        <div className="uf-grid uf-grid--3">
          {entries?.map((entry, idx) => (
            <Link key={entry._id} to={`/lore/${entry.slug}`} className="block">
              <ScaleReveal staggerIndex={idx}>
                <HoloCard>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {entry.faction ? <StatusPill variant="info">{entry.faction}</StatusPill> : null}
                    {entry.sector ? <StatusPill variant="violet">{entry.sector}</StatusPill> : null}
                    {entry.classification ? (
                      <StatusPill variant="warning">{entry.classification}</StatusPill>
                    ) : null}
                    {entry.entryType ? (
                      <StatusPill variant="default">{entry.entryType}</StatusPill>
                    ) : null}
                  </div>
                  <h3 className="text-xl font-semibold">{entry.title}</h3>
                  <p className="text-uf-muted text-sm mt-2">{entry.excerpt}</p>
                </HoloCard>
              </ScaleReveal>
            </Link>
          ))}
          {entries === undefined &&
            [0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 160 }} />
            ))}
        </div>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
