import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import {
  AlertTriangle,
  ChevronRight,
  Crosshair,
  Database,
  Download,
  FileText,
  Printer,
  RefreshCw,
  Search,
  Shield,
  Target,
  X,
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

/** One attached file carried on a weapon record (image or schematic). */
type MediaRef = { src?: string; name?: string };

/** Shape of a canon weapon record served by the Hostinger armory API. */
export type CanonWeapon = {
  /** Stable identity for report selection — survives filtering/sorting. */
  _key: string;
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
  /** Attachments: the record's image and schematic files, when it has any. */
  images: MediaRef[];
  schematics: MediaRef[];
  /** Extra technical data: magazine capacity, feed mechanism, barrel length,
   *  and damage figures. Served once the upgraded weapons table carries
   *  them; feed / magazine / barrel also derive from canon text. */
  magazine?: string;
  feed?: string;
  barrel?: string;
  damage?: string;
  damageRadius?: string;
};

/** Hostinger SQL-backed armory API — the Armory subdomain's existing
 *  weapons.php endpoint (config.php + weapons.php + MySQL). Read straight
 *  from the browser; needs the Access-Control-Allow-Origin header set in
 *  weapons.php, the same one-line fix as personnel's records.php. */
const ARMORY_API_URL = "https://armory.starforcebase1198.com/weapons.php";

function s(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}

/** Normalize every shape an attachment can arrive in — a bare URL string,
 *  an array of them, or the armory app's {file_path, original_name} rows.
 *  A single JSON-encoded string (the SQL column served raw by an older
 *  weapons.php) is decoded first so the card still finds the attachment. */
export function mediaList(v: unknown): MediaRef[] {
  const out: MediaRef[] = [];
  if (typeof v === "string") {
    const t = v.trim();
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        const parsed: unknown = JSON.parse(t);
        if (Array.isArray(parsed) || (parsed && typeof parsed === "object")) {
          return mediaList(parsed);
        }
      } catch {
        // Not JSON after all — fall through and treat it as a bare src.
      }
    }
  }
  const push = (item: unknown) => {
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push({ src: t });
      return;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const src = s(o.file_path) ?? s(o.filePath) ?? s(o.url) ?? s(o.src);
      const name = s(o.original_name) ?? s(o.name);
      if (src || name) out.push({ src, name });
    }
  };
  if (Array.isArray(v)) v.forEach(push);
  else push(v);
  return out;
}

/** Only image-safe schemes may reach an `src` attribute. */
export function safeSrc(src?: string): string | undefined {
  const t = src?.trim();
  if (!t) return undefined;
  return /^(https?:|data:image\/|blob:)/i.test(t) ? t : undefined;
}

/** The tactical plate the original armory app drew for every record. Each
 *  weapon keeps the same visual asset the embedded front end showed, even
 *  when no photograph is attached to the row. */
function weaponPlate(title: string, subtitle: string): string {
  const esc = (v: string) =>
    v.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
    );
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">',
    '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="#050a14"/><stop offset="100%" stop-color="#0a1628"/>',
    "</linearGradient></defs>",
    '<rect width="600" height="300" fill="url(#bg)"/>',
    '<rect x="20" y="20" width="560" height="260" rx="4" fill="none" stroke="#0e2a4a" stroke-width="2"/>',
    '<path d="M 40 60 L 560 60" stroke="#0e2a4a" stroke-dasharray="4 4"/>',
    '<text x="40" y="48" fill="#00e5ff" font-family="monospace" font-size="13" font-weight="bold" letter-spacing="2">STAR FORCE TACTICAL SCHEMATIC</text>',
    '<text x="560" y="48" fill="#ffd54f" font-family="monospace" font-size="12" text-anchor="end">SYS-VER 3.0</text>',
    '<path d="M 120 180 L 220 120 L 420 120 L 480 160 L 440 210 L 160 210 Z" fill="rgba(0,229,255,0.05)" stroke="#00e5ff" stroke-width="1.5"/>',
    '<circle cx="200" cy="165" r="18" fill="none" stroke="#ffd54f" stroke-width="1"/>',
    '<path d="M 240 140 L 380 140 L 360 190 L 260 190 Z" fill="rgba(255,213,79,0.1)" stroke="#ffd54f" stroke-width="1"/>',
    `<text x="60" y="245" fill="#00e5ff" font-family="monospace" font-size="15" font-weight="bold">${esc(title.slice(0, 44))}</text>`,
    `<text x="60" y="265" fill="#8aacc1" font-family="monospace" font-size="11">${esc(subtitle.slice(0, 60))}</text>`,
    "</svg>",
  ].join("");
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** The record's visual asset: the first usable attached image, else the
 *  generated tactical plate (what the original front end rendered). */
export function imageSrcFor(weapon: CanonWeapon): string {
  const attached = weapon.images.map((im) => safeSrc(im.src)).find(Boolean);
  return (
    attached ??
    weaponPlate(
      weaponName(weapon),
      weapon.builder ? `${weapon.builder} · Star Force Armory` : "Star Force Armory · Sector 1198",
    )
  );
}

/** Selection key: server id → registry number → designation + raw index. */
function recordKey(w: Record<string, unknown>, i: number): string {
  return (
    s(w.id) ??
    s(w.registry_number) ??
    s(w.registryNumber) ??
    `${s(w.designation) ?? "record"}-${i}`
  );
}

function weaponName(w: CanonWeapon): string {
  return w.designation || w.registryNumber || "Unregistered";
}

/** Feed mechanism — the explicit column first, else derived from the
 *  taxonomy ("V. Teleporter-Fed Small Arms") and the ammunition text. */
function feedOf(weapon: CanonWeapon): string | undefined {
  if (weapon.feed?.trim()) return weapon.feed;
  const hay = `${weapon.category ?? ""} ${weapon.primarySpec ?? ""}`.toLowerCase();
  if (
    hay.includes("teleporter-fed") ||
    hay.includes("teleporter fed") ||
    hay.includes("portal node")
  ) {
    return "Teleporter-fed";
  }
  const fleet = (weapon.fleet ?? "").toLowerCase();
  if (fleet.includes("magazine") || fleet.includes("clip")) return "Magazine-fed";
  if (fleet.includes("belt")) return "Belt-fed";
  if (fleet.includes("capacitor") || fleet.includes("cell")) return "Energy-cell fed";
  return undefined;
}

/** Magazine capacity — the explicit column first, else the round count the
 *  ammunition cell already states ("30-round … magazine"), or the portal
 *  feed's infinite capacity the primary specification declares. */
function magazineOf(weapon: CanonWeapon): string | undefined {
  if (weapon.magazine?.trim()) return weapon.magazine;
  if (/infinite magazine/i.test(weapon.primarySpec ?? "")) {
    return "Unlimited (teleporter-fed)";
  }
  const m = /(\d[\d,]*[\s-]?round(?:s)?[^,;.]*?)\s*$/i.exec(weapon.fleet ?? "");
  return m?.[1]?.trim() || undefined;
}

/** Barrel length — the explicit column first, else the melee reach the range
 *  text records ("Melee (90 cm length)"). */
function barrelOf(weapon: CanonWeapon): string | undefined {
  if (weapon.barrel?.trim()) return weapon.barrel;
  const m = /\((\d+(?:[.,]\d+)?\s*(?:cm|mm|m))\s*length\)/i.exec(
    weapon.range ?? "",
  );
  return m?.[1] ? m[1].replace(",", ".") : undefined;
}

/** Every field worth printing — shared by the dossier card and the report. */
function weaponSpecs(
  weapon: CanonWeapon,
): Array<{ label: string; value: string }> {
  return [
    { label: "Registry", value: weapon.registryNumber },
    { label: "Class", value: weapon.category },
    { label: "Status", value: weapon.status },
    { label: "Builder", value: weapon.builder },
    { label: "Ammunition cell", value: weapon.fleet },
    { label: "Effective range", value: weapon.range },
    { label: "Rate of fire", value: weapon.rof },
    { label: "Feed", value: feedOf(weapon) },
    { label: "Magazine capacity", value: magazineOf(weapon) },
    { label: "Barrel length", value: barrelOf(weapon) },
    { label: "Damage", value: weapon.damage },
    { label: "Damage radius", value: weapon.damageRadius },
  ].filter((v): v is { label: string; value: string } =>
    Boolean(v.value?.trim()),
  );
}

export function ArmoryBrowser() {
  const [records, setRecords] = useState<CanonWeapon[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Records staged for the report — any number of them, or all of them.
  const [stagedKeys, setStagedKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Cache-buster: the API sent no caching header, so a browser or CDN
      // could replay the arsenal from before a save and make a successful
      // database write look like it never happened.
      const res = await fetch(`${ARMORY_API_URL}?t=${Date.now()}`, {
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      });
      if (!res.ok) {
        throw new Error(`Armory database error (HTTP ${res.status}).`);
      }
      const data: unknown = await res.json();
      const raw = Array.isArray(data)
        ? data
        : (data as { records?: unknown } | null)?.records;
      // Manifests are hand-edited on the subdomain, so two records can share
      // a designation — de-dupe the selection keys so React keys and staged
      // toggles never collide.
      const usedKeys = new Set<string>();
      const nextKey = (w: Record<string, unknown>, i: number): string => {
        const base = recordKey(w, i);
        let key = base;
        let n = 2;
        while (usedKeys.has(key)) key = `${base}-${n++}`;
        usedKeys.add(key);
        return key;
      };

      const mapped: CanonWeapon[] = Array.isArray(raw)
        ? (raw as Record<string, unknown>[]).map((w, i) => ({
            _key: nextKey(w, i),
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
            images: mediaList(
              w.images ?? w.image ?? w.image_url ?? w.imageUrl ?? w.preview_image,
            ),
            schematics: mediaList(
              w.schematics ?? w.schematic ?? w.schematic_url ?? w.schematicUrl,
            ),
            magazine:
              s(w.magazine_capacity) ?? s(w.magCapacity) ?? s(w.magazine),
            feed: s(w.feed_mechanism) ?? s(w.feedMechanism) ?? s(w.feed),
            barrel: s(w.barrel_length) ?? s(w.barrelLength) ?? s(w.barrel),
            damage: s(w.damage) ?? s(w.destructive_power),
            damageRadius: s(w.damage_radius) ?? s(w.damageRadius),
          }))
        : [];
      setRecords(mapped);
      setSelectedIndex(0);
      setStagedKeys(new Set());
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

  /** The report payload: every staged record, in manifest order. */
  const stagedWeapons = useMemo(
    () => sorted.filter((w) => stagedKeys.has(w._key)),
    [sorted, stagedKeys],
  );

  const stage = useCallback((key: string) => {
    setStagedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const stageAllRecords = useCallback(() => {
    setStagedKeys(new Set((records ?? []).map((w) => w._key)));
  }, [records]);

  const stageShown = useCallback(() => {
    setStagedKeys((prev) => {
      const next = new Set(prev);
      for (const w of filtered) next.add(w._key);
      return next;
    });
  }, [filtered]);

  const clearStaged = useCallback(() => setStagedKeys(new Set()), []);

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      {/* ---- Arsenal list column ---- */}
      <section aria-label="Arsenal manifest" className="uf-panel flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[color:var(--uf-border)]">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <p className="uf-eyebrow mb-0">Arsenal manifest</p>
            <span className="text-[11px] uppercase tracking-[0.14em] text-uf-muted">
              {records ? `${records.length} on file` : ""}
            </span>
          </div>
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

          {/* Record staging — tick any number of records, or all of them. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button
              type="button"
              onClick={stageAllRecords}
              disabled={!records?.length}
              className="text-[11px] uppercase tracking-[0.14em] text-uf-cyan hover:text-uf-text transition-colors underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Select all ({records?.length ?? 0})
            </button>
            {query.trim() && filtered.length > 0 ? (
              <button
                type="button"
                onClick={stageShown}
                className="text-[11px] uppercase tracking-[0.14em] text-uf-cyan hover:text-uf-text transition-colors underline-offset-4 hover:underline"
              >
                Select shown ({filtered.length})
              </button>
            ) : null}
            <button
              type="button"
              onClick={clearStaged}
              disabled={stagedKeys.size === 0}
              className="text-[11px] uppercase tracking-[0.14em] text-uf-muted hover:text-uf-text transition-colors underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Clear
            </button>
            <span
              aria-live="polite"
              className="ml-auto text-[11px] uppercase tracking-[0.14em] text-uf-amber"
            >
              {stagedKeys.size} selected
            </span>
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
          <ul className="list-none m-0 p-2 flex-1 overflow-y-auto lg:max-h-[80vh] flex flex-col gap-1">
            {filtered.map((w) => {
              const active = selected === w;
              const staged = stagedKeys.has(w._key);
              const name = weaponName(w);
              const sub = w.category || "Unclassified";
              return (
                <li
                  key={w._key}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-2 transition-colors ${
                    active
                      ? "border-[rgba(0,229,255,0.5)] bg-[rgba(0,229,255,0.08)]"
                      : staged
                        ? "border-[rgba(255,179,0,0.4)] bg-[rgba(255,179,0,0.06)]"
                        : "border-transparent hover:border-[color:var(--uf-border)] hover:bg-[rgba(16,24,39,0.45)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={staged}
                    onChange={() => stage(w._key)}
                    aria-label={`Include ${name} in the report`}
                    className="h-4 w-4 shrink-0 cursor-pointer"
                    style={{ accentColor: "var(--uf-cyan, #00e5ff)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setSelectedIndex(filtered.indexOf(w))}
                    aria-pressed={active}
                    className="min-w-0 flex-1 flex items-center gap-3 text-left"
                  >
                    <span
                      aria-hidden
                      className="h-9 w-9 rounded-md shrink-0 grid place-items-center"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(255,179,0,0.16), rgba(0,229,255,0.10))",
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
                </li>
              );
            })}
          </ul>
        )}

        {/* ---- Report bar ---- */}
        <div className="mt-auto p-3 border-t border-[color:var(--uf-border)] flex items-center justify-between gap-3">
          <p className="text-xs text-uf-muted">
            {stagedKeys.size > 0
              ? `${stagedKeys.size} record${stagedKeys.size === 1 ? "" : "s"} staged for the report.`
              : "Tick records to stage them — or take them all."}
          </p>
          <NeonButton
            variant="gold"
            className="uf-btn--sm"
            disabled={stagedWeapons.length === 0}
            onClick={() => setReportOpen(true)}
          >
            <FileText className="h-4 w-4" aria-hidden />
            Produce report ({stagedWeapons.length})
          </NeonButton>
        </div>
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
          <WeaponDossier
            key={selected._key}
            weapon={selected}
            staged={stagedKeys.has(selected._key)}
            onToggleStaged={() => stage(selected._key)}
          />
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

      {reportOpen && stagedWeapons.length > 0
        ? createPortal(
            <ArsenalReportDialog
              weapons={stagedWeapons}
              onClose={() => setReportOpen(false)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Arsenal report — staged records as a printable document + CSV export
// ---------------------------------------------------------------------------

function ArsenalReportDialog({
  weapons,
  onClose,
}: {
  weapons: CanonWeapon[];
  onClose: () => void;
}) {
  const stamp = useMemo(
    () =>
      new Date().toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      }),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function downloadCsv() {
    const header = [
      "#",
      "Registry",
      "Designation",
      "Class",
      "Builder",
      "Status",
      "Ammunition cell",
      "Effective range",
      "Rate of fire",
      "Primary specification",
      "Images",
      "Schematics",
      "Feed",
      "Magazine capacity",
      "Barrel length",
      "Damage",
      "Damage radius",
    ];
    const rows = weapons.map((w, i) => [
      String(i + 1),
      w.registryNumber ?? "",
      w.designation ?? "",
      w.category ?? "",
      w.builder ?? "",
      w.status ?? "",
      w.fleet ?? "",
      w.range ?? "",
      w.rof ?? "",
      w.primarySpec ?? "",
      String(w.images.length),
      String(w.schematics.length),
      feedOf(w) ?? "",
      magazineOf(w) ?? "",
      barrelOf(w) ?? "",
      w.damage ?? "",
      w.damageRadius ?? "",
    ]);
    const csv = [header, ...rows]
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `armory-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div
      id="armory-report-overlay"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(2,6,18,0.88)] p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="armory-report-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="armory-report-title"
        className="uf-dossier w-full max-w-3xl p-6 md:p-8"
      >
        {/* The printable document — everything the print sheet shows. */}
        <div id="armory-report">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--uf-border)] pb-4">
            <div className="min-w-0">
              <p className="uf-eyebrow mb-1">
                Star Force Armory · Sector 1198 arsenal manifest
              </p>
              <h2 id="armory-report-title" className="text-2xl font-semibold">
                Arsenal report
              </h2>
              <p className="text-uf-muted text-sm mt-1">
                {weapons.length} record{weapons.length === 1 ? "" : "s"} ·
                generated {stamp}
              </p>
            </div>
            <StatusPill variant="gold">Ordnance</StatusPill>
          </header>

          <ol className="list-none m-0 mt-5 p-0 flex flex-col gap-5">
            {weapons.map((w, i) => (
              <ReportEntry key={w._key} weapon={w} index={i + 1} />
            ))}
          </ol>

          <footer className="mt-6 border-t border-[color:var(--uf-border)] pt-4">
            <p className="text-xs text-uf-muted">
              Source: STAR FORCE ARMORY · armory.starforcebase1198.com ·
              {weapons.length} of {weapons.length} staged records listed.
            </p>
          </footer>
        </div>

        <footer className="mt-6 border-t border-[color:var(--uf-border)] pt-4 flex flex-wrap items-center justify-end gap-3">
          <NeonButton variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
            Close
          </NeonButton>
          <NeonButton variant="primary" onClick={downloadCsv}>
            <Download className="h-4 w-4" aria-hidden />
            Download CSV
          </NeonButton>
          <NeonButton variant="gold" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            Print / Save as PDF
          </NeonButton>
        </footer>
      </div>
    </div>
  );
}

function ReportEntry({ weapon, index }: { weapon: CanonWeapon; index: number }) {
  const specs = weaponSpecs(weapon);
  return (
    <li className="border border-[color:var(--uf-border)] rounded-lg p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-uf-muted">
          {String(index).padStart(2, "0")}
        </span>
        <h3 className="text-lg font-semibold">{weaponName(weapon)}</h3>
        <span className="text-xs text-uf-muted">
          {weapon.category ?? "Unclassified"}
        </span>
        {weapon.status ? (
          <StatusPill variant="gold" className="ml-auto">
            {weapon.status.toUpperCase()}
          </StatusPill>
        ) : null}
      </div>
      {specs.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
          {specs.map((sp) => (
            <div key={sp.label}>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-uf-muted">
                {sp.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold break-words">
                {sp.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-3 flex flex-wrap items-start gap-4">
        <img
          src={imageSrcFor(weapon)}
          alt={`${weaponName(weapon)} — tactical visual asset`}
          className="w-full sm:w-56 rounded-md border border-[color:var(--uf-border)]"
        />
        <div className="flex-1 min-w-[12rem]">
          <p className="text-[11px] uppercase tracking-[0.16em] text-uf-muted mb-1">
            Attachments
          </p>
          <p className="text-xs text-uf-muted">
            {weapon.images.length} image{weapon.images.length === 1 ? "" : "s"} ·{" "}
            {weapon.schematics.length} schematic
            {weapon.schematics.length === 1 ? "" : "s"} on file
            {weapon.schematics.length > 0 ? (
              <>
                {": "}
                {weapon.schematics
                  .map((sc) => sc.name ?? "unnamed")
                  .join(", ")}
              </>
            ) : null}
            .
          </p>
        </div>
      </div>
      {weapon.primarySpec?.trim() ? (
        <p className="mt-3 text-sm leading-relaxed">{weapon.primarySpec}</p>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Arsenal row + weapon file card
// ---------------------------------------------------------------------------

/** The record's image and schematic slots — the two frames the original
 *  front end kept for a weapon's visual asset and attached drawings. */
function WeaponMedia({ weapon }: { weapon: CanonWeapon }) {
  const name = weaponName(weapon);
  const images = weapon.images
    .map((im) => ({ name: im.name, src: safeSrc(im.src) }))
    .filter((im) => im.src || im.name);
  const schematics = weapon.schematics
    .map((sc) => ({ name: sc.name, src: safeSrc(sc.src) }))
    .filter((sc) => sc.src || sc.name);

  return (
    <section className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Image and schematic">
      <figure className="m-0 min-w-0">
        <figcaption className="text-[11px] uppercase tracking-[0.16em] text-uf-muted mb-2">
          Image
        </figcaption>
        <div className="rounded-md overflow-hidden border border-[color:var(--uf-border)] bg-[rgba(5,10,20,0.6)]">
          <img
            src={imageSrcFor(weapon)}
            alt={`${name} — tactical visual asset`}
            className="block w-full h-auto"
            loading="lazy"
          />
        </div>
        <p className="text-xs text-uf-muted mt-2">
          {images.length > 0
            ? `${images.length} image${images.length === 1 ? "" : "s"} linked.`
            : "No photograph on file — generated plate shown."}
        </p>
      </figure>

      <div className="min-w-0 flex flex-col">
        <p className="text-[11px] uppercase tracking-[0.16em] text-uf-muted mb-2">
          Schematic
        </p>
        {schematics.length > 0 ? (
          <ul className="list-none m-0 flex flex-col gap-2 rounded-md border border-[color:var(--uf-border)] p-3">
            {schematics.map((sc, i) => (
              <li key={`${sc.name ?? "schematic"}-${i}`} className="text-sm">
                {sc.src ? (
                  <a
                    href={sc.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-uf-cyan hover:text-uf-text transition-colors underline-offset-4 hover:underline break-all"
                  >
                    {sc.name ?? `Schematic ${i + 1}`}
                  </a>
                ) : (
                  <span className="break-words">{sc.name}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex-1 grid place-items-center text-center rounded-md border border-dashed border-[color:var(--uf-border)] p-6 sm:aspect-[2/1]">
            <div>
              <FileText className="h-6 w-6 mx-auto mb-2 opacity-60" aria-hidden />
              <p className="text-sm text-uf-muted">
                No schematic on file. Attach one from the armory app and it
                will appear here.
              </p>
            </div>
          </div>
        )}
        <p className="text-xs text-uf-muted mt-2">
          {schematics.length} schematic{schematics.length === 1 ? "" : "s"} linked.
        </p>
      </div>
    </section>
  );
}

function WeaponDossier({
  weapon,
  staged,
  onToggleStaged,
}: {
  weapon: CanonWeapon;
  staged: boolean;
  onToggleStaged: () => void;
}) {
  const name = weaponName(weapon);
  const specs = weaponSpecs(weapon);

  return (
    <article className="uf-dossier p-6 md:p-8" aria-label={`Weapon file: ${name}`}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <span
            aria-hidden
            className="h-16 w-16 rounded-xl grid place-items-center shrink-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,179,0,0.18), rgba(122,43,217,0.18))",
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
            <p className="text-uf-muted text-sm mt-0.5">
              {weapon.category ?? "Unclassified"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <StatusPill variant="gold">
            {(weapon.status ?? "Active").toUpperCase()}
          </StatusPill>
          <StatusPill variant="info">Ordnance</StatusPill>
        </div>
      </header>

      <WeaponMedia weapon={weapon} />

      {specs.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-6 border-t border-[color:var(--uf-border)] pt-5">
          {specs.map((sp) => (
            <div key={sp.label}>
              <dt className="text-[11px] uppercase tracking-[0.16em] text-uf-muted">
                {sp.label}
              </dt>
              <dd className="mt-1 text-base font-semibold break-words">{sp.value}</dd>
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

      <footer className="mt-6 border-t border-[color:var(--uf-border)] pt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-uf-muted">
          Source: STAR FORCE ARMORY · Sector 1198 arsenal manifest
        </p>
        <button
          type="button"
          onClick={onToggleStaged}
          aria-pressed={staged}
          className={`text-[11px] uppercase tracking-[0.14em] transition-colors underline-offset-4 hover:underline ${
            staged ? "text-uf-amber" : "text-uf-cyan hover:text-uf-text"
          }`}
        >
          {staged ? "✓ Staged for report — remove" : "+ Stage for report"}
        </button>
      </footer>
    </article>
  );
}
