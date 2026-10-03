import {
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { HoloCard, NeonButton, PageHero, StatusPill } from "@/components/uf";
import { ScaleReveal } from "@/hooks/use-scroll-reveal";
import {
  Archive,
  Check,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import goldPlateUrl from "@/assets/gold-plate-texture.jpg";
import {
  normalizeSeedRows,
  parseSeedFile,
  type LabFieldGroup,
} from "@/lib/labFields";
import { ImageUploadField } from "@/components/labs/ImageUploadField";

// =========================================================================
// LabWorkbench — the shared command deck behind the Biology Lab
// (/biology-lab) and Research Lab (/research-lab).
//
// Three stations:
//   1. Seed bay (operators only) — upload CSV/TSV/JSON, preview the parsed
//      rows, then bulk-import them into the database (deduped by name).
//   2. Intake form — the full field set, grouped, gold-trimmed.
//   3. Dossier list — every published entry (plus your pending rows), with
//      operator approve/reject/remove controls.
//
// All data access lives in the page that renders this component; the
// workbench only shapes inputs and emits callbacks.
// =========================================================================

export type LabRecord = Record<string, unknown> & {
  _id: string;
  pending?: boolean;
};

type LabWorkbenchProps = {
  eyebrow: string;
  title: string;
  lead: string;
  nameKey: string;
  nameLabel: string;
  groups: LabFieldGroup[];
  records: LabRecord[] | undefined;
  isAuthenticated: boolean;
  isOperator: boolean;
  busy: boolean;
  seeding: boolean;
  /** Returns the resulting status so the toast can reflect review state. */
  onCreate: (values: Record<string, unknown>) => Promise<"approved" | "pending">;
  onSeed: (
    rows: Record<string, unknown>[],
  ) => Promise<{ inserted: number; skipped: number }>;
  onReview: (id: string, approve: boolean) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

// ---- Gold plate accents (same asset as the Forge of Canon) ---------------
const goldLayer = `linear-gradient(180deg, rgba(255,244,200,0.50) 0%, rgba(255,255,255,0) 35%, rgba(90,60,10,0.26) 100%), url(${goldPlateUrl})`;

const GOLD_PLATE: CSSProperties = {
  backgroundImage: goldLayer,
  backgroundSize: "100% 100%, cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
};

const GOLD_RULE: CSSProperties = {
  backgroundImage: `linear-gradient(90deg, rgba(243,200,73,0.95) 0%, rgba(230,168,23,0.35) 60%, rgba(230,168,23,0) 100%), url(${goldPlateUrl})`,
  backgroundSize: "100% 100%, cover",
};

function GoldEdge() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
      style={GOLD_RULE}
    />
  );
}

function GoldDivider({ glyph = "◆" }: { glyph?: string }) {
  return (
    <div className="my-6 flex items-center gap-3" aria-hidden>
      <span className="h-[2px] flex-1" style={GOLD_RULE} />
      <span
        className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-sm border border-[color:var(--uf-gold)] px-1.5 text-[0.6rem] font-bold text-[#1A1300] animate-pulse"
        style={GOLD_PLATE}
      >
        {glyph}
      </span>
      <span
        className="h-[2px] flex-1"
        style={{
          backgroundImage: `linear-gradient(270deg, rgba(243,200,73,0.95) 0%, rgba(230,168,23,0.35) 60%, rgba(230,168,23,0) 100%), url(${goldPlateUrl})`,
          backgroundSize: "100% 100%, cover",
        }}
      />
    </div>
  );
}

const IMAGE_KEY = /(image|portrait|photo|blueprint)/i;

export function LabWorkbench({
  eyebrow,
  title,
  lead,
  nameKey,
  nameLabel,
  groups,
  records,
  isAuthenticated,
  isOperator,
  busy,
  seeding,
  onCreate,
  onSeed,
  onReview,
  onRemove,
}: LabWorkbenchProps) {
  const allFields = useMemo(
    () => groups.flatMap((g) => g.fields),
    [groups],
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<
    | {
        fileName: string;
        rows: Record<string, unknown>[];
        skipped: number;
        unknownColumns: string[];
      }
    | null
  >(null);

  const set = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const filtered = useMemo(() => {
    const list = records ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r[nameKey], r.classification, r.canonNotes]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [records, search, nameKey]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!String(values[nameKey] ?? "").trim()) {
      toast.error(`${nameLabel} is required.`);
      return;
    }
    const payload: Record<string, unknown> = {};
    for (const f of allFields) {
      const raw = (values[f.key] ?? "").trim();
      if (!raw) continue;
      if (f.type === "number") {
        const n = Number(raw.replace(/[^\d.-]/g, ""));
        if (!Number.isNaN(n)) payload[f.key] = n;
      } else payload[f.key] = raw;
    }
    try {
      const status = await onCreate(payload);
      setValues({});
      toast.success(
        status === "approved"
          ? "Published to the database."
          : "Filed — awaiting operator review.",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    }
  };

  const handleFile = async (file: File) => {
    try {
      const raw = await parseSeedFile(file);
      const { rows, skipped, unknownColumns } = normalizeSeedRows(
        raw,
        groups,
        nameKey,
      );
      if (!rows.length) {
        toast.error(
          `No usable rows — every row needs a "${nameKey}" column/value.`,
        );
        return;
      }
      setPreview({ fileName: file.name, rows, skipped, unknownColumns });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't read that file.",
      );
    }
  };

  const runSeed = async () => {
    if (!preview?.rows.length) return;
    if (
      !window.confirm(
        `Import ${preview.rows.length} row(s) from ${preview.fileName}? Existing names are skipped.`,
      )
    )
      return;
    try {
      const res = await onSeed(preview.rows);
      toast.success(
        `Seeded ${res.inserted} entr${res.inserted === 1 ? "y" : "ies"} · ${res.skipped} skipped.`,
      );
      setPreview(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Seed failed.");
    }
  };

  const downloadTemplate = () => {
    const keys = allFields.map((f) => f.key);
    const csv = [
      keys.join(","),
      keys.map((k, i) => (i === 0 ? `Example ${nameLabel}` : "")).join(","),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nameKey}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        lead={lead}
        primary={{ label: "File a new entry", href: "#lab-new", variant: "primary" }}
        secondary={{ label: "Back to the Forge", href: "/creator", variant: "ghost" }}
      />

      {/* ---------------------------------------------------------------
          1 — SEED BAY (operators)
      --------------------------------------------------------------- */}
      {isOperator ? (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-10">
          <HoloCard className="relative">
            <GoldEdge />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="uf-eyebrow uf-eyebrow--gold">Seed bay</span>
                <h2 className="text-xl font-semibold mt-1">
                  Upload a file and seed the database
                </h2>
                <p className="text-uf-muted text-sm mt-1 max-w-2xl">
                  CSV, TSV, or JSON. Column headers match the field keys —{" "}
                  <span className="font-mono text-uf-cyan">{nameKey}</span> is
                  required; unknown columns are dropped; names already in the
                  database are skipped.
                </p>
              </div>
              <NeonButton variant="ghost" onClick={downloadTemplate}>
                <FileText className="h-4 w-4" aria-hidden /> CSV template
              </NeonButton>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="uf-btn uf-btn--primary cursor-pointer">
                <Plus className="h-4 w-4" aria-hidden />
                Choose file
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.json,application/json,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {preview ? (
                <span className="text-uf-muted text-sm font-mono">
                  {preview.fileName} · {preview.rows.length} ready
                  {preview.skipped ? ` · ${preview.skipped} skipped` : ""}
                  {preview.unknownColumns.length
                    ? ` · ignored: ${preview.unknownColumns.join(", ")}`
                    : ""}
                </span>
              ) : (
                <span className="text-uf-muted text-sm">
                  No file staged yet.
                </span>
              )}
            </div>

            {preview ? (
              <div className="mt-4 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.45)] p-3">
                <p className="uf-eyebrow uf-eyebrow--gold mb-2">Preview</p>
                <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
                  {preview.rows.slice(0, 8).map((r, i) => (
                    <li key={i}>
                      <StatusPill variant="info">
                        {String(r[nameKey])}
                      </StatusPill>
                    </li>
                  ))}
                  {preview.rows.length > 8 ? (
                    <li>
                      <StatusPill variant="default">
                        +{preview.rows.length - 8} more
                      </StatusPill>
                    </li>
                  ) : null}
                </ul>
                <div className="mt-3 flex gap-2">
                  <NeonButton
                    variant="gold"
                    onClick={runSeed}
                    loading={seeding}
                    disabled={seeding}
                  >
                    Seed database
                  </NeonButton>
                  <NeonButton variant="ghost" onClick={() => setPreview(null)}>
                    <X className="h-4 w-4" aria-hidden /> Clear
                  </NeonButton>
                </div>
              </div>
            ) : null}
          </HoloCard>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------
          2 — INTAKE FORM
      --------------------------------------------------------------- */}
      <section
        className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12"
        id="lab-new"
      >
        <header className="mb-6">
          <span className="uf-eyebrow uf-eyebrow--gold">Intake</span>
          <h2 className="text-3xl font-semibold mt-2">
            Record a new {nameLabel.toLowerCase()}.
          </h2>
          <span
            aria-hidden
            className="mt-3 block h-[3px] w-36 rounded-full"
            style={GOLD_RULE}
          />
          <p className="text-uf-muted text-sm mt-3 max-w-2xl">
            {isOperator
              ? "Operator entries publish immediately."
              : "Member entries enter the operator review queue — you'll see them marked pending below."}
          </p>
        </header>

        {!isAuthenticated ? (
          <HoloCard>
            <p className="text-uf-muted text-sm">
              Sign in to file an entry.{" "}
              <Link to="/auth?returnTo=/creator" className="text-uf-cyan">
                Open auth
              </Link>
              .
            </p>
          </HoloCard>
        ) : (
          <form className="grid gap-0" onSubmit={submit}>
            {groups.map((g, gi) => (
              <div key={g.title}>
                {gi > 0 ? <GoldDivider glyph={String(gi + 1).padStart(2, "0")} /> : null}
                <div className={gi > 0 ? "mt-2" : ""}>
                  <h3 className="text-lg font-semibold">{g.title}</h3>
                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    {g.fields.map((f) =>
                      IMAGE_KEY.test(f.key) && f.type !== "textarea" ? (
                        <div key={f.key} className="sm:col-span-2">
                          <ImageUploadField
                            label={f.label}
                            value={values[f.key] ?? ""}
                            onChange={(v) => set(f.key, v)}
                            placeholder={f.placeholder}
                            disabled={!isAuthenticated}
                          />
                        </div>
                      ) : f.type === "textarea" ? (
                        <label
                          key={f.key}
                          className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1 sm:col-span-2"
                        >
                          {f.label}
                          <textarea
                            value={values[f.key] ?? ""}
                            onChange={(e) => set(f.key, e.target.value)}
                            rows={3}
                            placeholder={f.placeholder}
                            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                          />
                        </label>
                      ) : (
                        <label
                          key={f.key}
                          className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1"
                        >
                          {f.label}
                          <input
                            value={values[f.key] ?? ""}
                            onChange={(e) => set(f.key, e.target.value)}
                            type={f.type === "number" ? "number" : "text"}
                            placeholder={f.placeholder}
                            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                          />
                        </label>
                      ),
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="mt-6 flex gap-2">
              <NeonButton
                variant="gold"
                type="submit"
                loading={busy}
                disabled={busy}
              >
                {isOperator ? "Publish entry" : "Submit for review"}
              </NeonButton>
              <NeonButton variant="ghost" type="button" onClick={() => setValues({})}>
                Clear form
              </NeonButton>
            </div>
          </form>
        )}
      </section>

      {/* ---------------------------------------------------------------
          3 — DOSSIER LIST
      --------------------------------------------------------------- */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 pt-0">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="uf-eyebrow uf-eyebrow--gold">On file</span>
            <h2 className="text-2xl font-semibold mt-1">
              {records === undefined
                ? "Loading dossiers…"
                : `${records.length} ${records.length === 1 ? "record" : "records"} on file`}
            </h2>
          </div>
          <label className="flex items-center gap-2 border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]">
            <Search className="h-4 w-4 text-uf-muted" aria-hidden />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`search ${nameLabel.toLowerCase()}s…`}
              className="bg-transparent outline-none w-44 text-uf-text"
            />
          </label>
        </header>

        {records === undefined ? (
          <div className="uf-grid uf-grid--3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 160 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="uf-empty">
            {records.length === 0
              ? `No entries yet — file the first one, or seed the database above.`
              : "Nothing matches that search."}
          </div>
        ) : (
          <div className="uf-grid uf-grid--3">
            {filtered.map((r, idx) => (
              <ScaleReveal key={r._id} staggerIndex={idx % 6}>
                <HoloCard className="h-full">
                  <GoldEdge />
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-semibold leading-tight">
                      {String(r[nameKey])}
                    </h3>
                    {r.pending ? (
                      <StatusPill variant="warning">pending</StatusPill>
                    ) : (
                      <StatusPill variant="gold">canon</StatusPill>
                    )}
                  </div>
                  {r.classification ? (
                    <p className="text-uf-muted text-sm mt-1">
                      {String(r.classification)}
                    </p>
                  ) : null}

                  <details className="mt-3">
                    <summary className="text-uf-cyan text-sm cursor-pointer">
                      Open dossier
                    </summary>
                    <dl className="mt-3 grid gap-2">
                      {allFields
                        .filter((f) => f.key !== nameKey && r[f.key])
                        .map((f) => (
                          <div
                            key={f.key}
                            className="grid sm:grid-cols-[150px_1fr] gap-2 border-b border-[color:var(--uf-border-subtle)] pb-2"
                          >
                            <dt className="text-[11px] uppercase tracking-[0.14em] text-uf-muted">
                              {f.label}
                            </dt>
                            <dd className="text-sm text-uf-text min-w-0">
                              {IMAGE_KEY.test(f.key) &&
                              /^https?:\/\//i.test(String(r[f.key])) ? (
                                <>
                                  <img
                                    src={String(r[f.key])}
                                    alt=""
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                    className="mb-1 max-h-24 rounded border border-[color:var(--uf-border)] object-contain"
                                  />
                                  <a
                                    href={String(r[f.key])}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-uf-cyan underline"
                                  >
                                    Open image ↗
                                  </a>
                                </>
                              ) : (
                                <span className="whitespace-pre-wrap break-words">
                                  {String(r[f.key])}
                                </span>
                              )}
                            </dd>
                          </div>
                        ))}
                    </dl>
                  </details>

                  {isOperator ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.pending ? (
                        <>
                          <NeonButton
                            variant="primary"
                            onClick={() => {
                              void onReview(r._id, true)
                                .then(() => toast.success("Approved & published."))
                                .catch((err) =>
                                  toast.error(
                                    err instanceof Error ? err.message : "Approve failed.",
                                  ),
                                );
                            }}
                          >
                            <Check className="h-4 w-4" aria-hidden /> Approve
                          </NeonButton>
                          <NeonButton
                            variant="danger"
                            onClick={() => {
                              if (window.confirm("Reject and delete this entry?")) {
                                void onReview(r._id, false)
                                  .then(() => toast.success("Rejected."))
                                  .catch(() => toast.error("Reject failed."));
                              }
                            }}
                          >
                            <X className="h-4 w-4" aria-hidden /> Reject
                          </NeonButton>
                        </>
                      ) : null}
                      <NeonButton
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Delete "${String(r[nameKey])}"?`)) {
                            void onRemove(r._id)
                              .then(() => toast.success("Deleted."))
                              .catch(() => toast.error("Delete failed."));
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </NeonButton>
                    </div>
                  ) : null}
                </HoloCard>
              </ScaleReveal>
            ))}
          </div>
        )}

        <div className="mt-8">
          <NeonButton variant="ghost" onClick={() => window.scrollTo({ top: 0 })}>
            <Archive className="h-4 w-4" aria-hidden /> Back to top
          </NeonButton>
        </div>
      </section>
    </>
  );
}
