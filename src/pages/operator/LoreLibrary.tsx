import type { ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { CanonScanPanel } from "@/components/operator/CanonScanPanel";
import { BatchCanonRescan } from "@/components/operator/BatchCanonRescan";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import {
  Archive,
  BookOpenText,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  Pencil,
  X,
  XCircle,
} from "lucide-react";

type Tab = "queue" | "library" | "databases";
type LoreType = "bible" | "image" | "database" | "map";

const TYPE_LABEL: Record<LoreType, string> = {
  bible: "Bible",
  image: "Image",
  database: "Database",
  map: "Map",
};

const STATUS_TONE: Record<string, "info" | "warning" | "gold" | "default" | "danger"> = {
  approved: "info",
  submitted: "warning",
  draft: "default",
  rejected: "danger",
  archived: "default",
};

/** Shape of an item being created/edited in the modal. Accepts both the
 *  Convex doc (`_id`) and the "new item" placeholder (`{ id: undefined }`). */
type LoreDraft = {
  id?: string;
  _id?: string;
  title?: string;
  description?: string;
  loreType?: string;
  status?: string;
  faction?: string;
  sector?: string;
  classification?: string;
  databaseUrl?: string;
  databaseName?: string;
  featured?: boolean;
  fileStorageId?: string;
  fileMeta?: { fileName: string; mimeType: string; byteSize: number };
  coverStorageId?: string;
  coverMeta?: { mimeType: string; byteSize: number };
};

export default function OperatorLoreLibrary() {
  const [tab, setTab] = useState<Tab>("queue");
  const [editing, setEditing] = useState<LoreDraft | null>(null);

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <BookOpenText className="h-6 w-6 text-uf-cyan" aria-hidden />
          Lore Library Desk
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Review member lore submissions, upload bibles / image plates from
          the console, and manage the subdomain-embedded databases.
        </p>
      </header>

      <div className="flex gap-2 mb-6 flex-wrap" role="tablist" aria-label="Lore library tabs">
        <TabButton active={tab === "queue"} onClick={() => setTab("queue")} icon={<CheckCircle2 className="h-4 w-4" aria-hidden />} label="Approval queue" />
        <TabButton active={tab === "library"} onClick={() => setTab("library")} icon={<BookOpenText className="h-4 w-4" aria-hidden />} label="Library" />
        <TabButton active={tab === "databases"} onClick={() => setTab("databases")} icon={<Database className="h-4 w-4" aria-hidden />} label="Database frontends" />
      </div>

      {tab === "queue" ? <ApprovalQueue /> : null}
      {tab === "library" ? <LibraryPanel onEdit={setEditing} /> : null}
      {tab === "databases" ? <DatabaseFrontends /> : null}

      {editing ? (
        <LoreItemEditorModal
          key={editing?._id ?? editing?.id ?? "new"}
          initial={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </OperatorShell>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`uf-btn ${active ? "uf-btn--primary" : ""}`}>
      {icon}
      {label}
    </button>
  );
}

// -------------------------------------------------------------------------
// Approval queue
// -------------------------------------------------------------------------

function ApprovalQueue() {
  const items = useQuery(api.loreLibrary.loreApprovalQueue, { limit: 50 });
  const act = useMutation(api.loreLibrary.loreApprovalAction);
  const [pending, setPending] = useState<string | null>(null);

  async function doAction(id: Id<"loreLibrary">, action: "approve" | "reject") {
    setPending(`${id}_${action}`);
    try {
      await act({ id, action });
      toast.success(action === "approve" ? "Approved — now in the library." : "Rejected.");
    } catch {
      toast.error("Action failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section aria-label="Lore approval queue">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Member submissions</h2>
        <BatchCanonRescan />
      </header>
      {items === undefined ? (
        <div className="uf-skeleton" style={{ height: 200 }} />
      ) : items.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">Queue is clear. No lore awaiting review.</div>
        </HoloCard>
      ) : (
        <ul className="flex flex-col gap-3 list-none p-0 m-0">
          {items.map((item) => (
            <li key={item._id}>
              <HoloCard>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{item.title}</h3>
                      <StatusPill variant="info">{TYPE_LABEL[item.loreType as LoreType] ?? item.loreType}</StatusPill>
                      <StatusPill variant="warning">submitted</StatusPill>
                    </div>
                    <p className="text-uf-muted text-sm mt-1 max-w-2xl">{item.description}</p>
                    <p className="text-uf-muted text-xs mt-2 flex flex-wrap gap-3">
                      {item.faction ? <span>Faction: {item.faction}</span> : null}
                      {item.sector ? <span>Sector: {item.sector}</span> : null}
                      {item.databaseUrl ? <span className="font-mono">{item.databaseUrl}</span> : null}
                      {item.fileMeta ? (
                        <span>
                          {item.fileMeta.fileName} · {formatBytes(item.fileMeta.byteSize)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {item.fileUrl ? (
                    <a href={item.fileUrl} target="_blank" rel="noreferrer">
                      <NeonButton variant="ghost">
                        <ExternalLink className="h-4 w-4" aria-hidden />
                        Preview file
                      </NeonButton>
                    </a>
                  ) : null}
                </div>
                <CanonScanPanel scan={item.canonScan} kind="lore" id={item._id} />
                <div className="flex flex-wrap gap-2">
                  <NeonButton
                    variant="primary"
                    disabled={pending === `${item._id}_approve`}
                    onClick={() => doAction(item._id, "approve")}
                  >
                    {pending === `${item._id}_approve` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                    Approve
                  </NeonButton>
                  <NeonButton
                    variant="danger"
                    disabled={pending === `${item._id}_reject`}
                    onClick={async () => {
                      if (window.confirm(`Reject "${item.title}"?`)) await doAction(item._id, "reject");
                    }}
                  >
                    <XCircle className="h-4 w-4" aria-hidden />
                    Reject
                  </NeonButton>
                </div>
              </HoloCard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// -------------------------------------------------------------------------
// Library management
// -------------------------------------------------------------------------

function LibraryPanel({ onEdit }: { onEdit: (e: LoreDraft) => void }) {
  const items = useQuery(api.loreLibrary.listAllLoreLibrary, { limit: 200 });
  const archive = useMutation(api.loreLibrary.archiveLoreItem);
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (items === undefined) return [];
    if (!filter.trim()) return items;
    const q = filter.toLowerCase();
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q) ||
        (i.loreType ?? "").toLowerCase().includes(q),
    );
  }, [items, filter]);

  return (
    <section aria-label="Lore library management">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">All items</h2>
        <div className="flex items-center gap-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search"
            className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
          <NeonButton variant="primary" onClick={() => onEdit({ id: undefined })}>
            <Pencil className="h-4 w-4" aria-hidden />
            New item
          </NeonButton>
        </div>
      </header>
      <HoloCard>
        {items === undefined ? (
          <div className="uf-skeleton" style={{ height: 120 }} />
        ) : filtered.length === 0 ? (
          <p className="uf-empty">No lore library items match.</p>
        ) : (
          <ul className="flex flex-col gap-2 list-none p-0 m-0">
            {filtered.map((item) => (
              <li
                key={item._id}
                className="flex items-center justify-between gap-3 border border-[color:var(--uf-border)] rounded-md px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate">{item.title}</p>
                  <p className="text-uf-muted text-xs flex flex-wrap gap-2 mt-1">
                    <StatusPill variant="info">{TYPE_LABEL[item.loreType as LoreType] ?? item.loreType}</StatusPill>
                    <StatusPill variant={STATUS_TONE[item.status] ?? "default"}>{item.status}</StatusPill>
                    {item.faction ? <StatusPill variant="default">{item.faction}</StatusPill> : null}
                    {item.featured ? <StatusPill variant="gold">Featured</StatusPill> : null}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <NeonButton variant="ghost" onClick={() => onEdit(item)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Edit
                  </NeonButton>
                  <NeonButton
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Archive "${item.title}"?`))
                        archive({ id: item._id })
                          .then(() => toast.success("Archived."))
                          .catch(() => toast.error("Archive failed."));
                    }}
                  >
                    <Archive className="h-4 w-4" aria-hidden />
                  </NeonButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </HoloCard>
    </section>
  );
}

// -------------------------------------------------------------------------
// Editor modal (console uploads)
// -------------------------------------------------------------------------

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];
const DOC_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
];

type Uploaded = {
  storageId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

function LoreItemEditorModal({ initial, onClose }: { initial: LoreDraft; onClose: () => void }) {
  const upsert = useMutation(api.loreLibrary.upsertLoreItem);
  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const [busy, setBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    id: initial?._id ?? initial?.id,
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    loreType: (initial?.loreType as LoreType) ?? "bible",
    status: initial?.status ?? "approved",
    faction: initial?.faction ?? "",
    sector: initial?.sector ?? "",
    classification: initial?.classification ?? "",
    databaseUrl: initial?.databaseUrl ?? "",
    databaseName: initial?.databaseName ?? "",
    featured: initial?.featured ?? false,
  });
  const [file, setFile] = useState<Uploaded | null>(
    initial?.fileStorageId && initial?.fileMeta
      ? {
          storageId: initial.fileStorageId,
          fileName: initial.fileMeta.fileName,
          mimeType: initial.fileMeta.mimeType,
          byteSize: initial.fileMeta.byteSize,
        }
      : null,
  );
  const [cover, setCover] = useState<Uploaded | null>(
    initial?.coverStorageId && initial?.coverMeta
      ? {
          storageId: initial.coverStorageId,
          fileName: "cover",
          mimeType: initial.coverMeta.mimeType,
          byteSize: initial.coverMeta.byteSize,
        }
      : null,
  );

  // No sync-from-props effect: the modal is remounted per item via `key`,
  // so the useState initializers above always see the right `initial`.
  const allowedMime =
    form.loreType === "image" || form.loreType === "map"
      ? IMAGE_MIME
      : [...DOC_MIME, ...IMAGE_MIME];

  async function uploadFile(f: File, setter: (u: Uploaded) => void, setBusyFlag: (b: boolean) => void) {
    if (f.size > 25 * 1024 * 1024) {
      toast.error("Max 25 MB.");
      return;
    }
    if (!allowedMime.includes(f.type) && f.type !== "image/jpeg") {
      toast.error("Unsupported file type.");
      return;
    }
    setBusyFlag(true);
    try {
      const url = await generateUploadUrl({ purpose: "lore-library" });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": f.type },
        body: f,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };
      setter({ storageId, fileName: f.name, mimeType: f.type, byteSize: f.size });
      toast.success("Uploaded.");
    } catch {
      toast.error("Upload failed.");
    } finally {
      setBusyFlag(false);
    }
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Title required.");
    if (form.loreType === "database" && !form.databaseUrl.trim()) {
      return toast.error("Databases need their subdomain URL.");
    }
    if ((form.loreType === "image" || form.loreType === "map") && !file) {
      return toast.error(
        form.loreType === "map" ? "Map items need an image file." : "Image items need a file.",
      );
    }
    setBusy(true);
    try {
      await upsert({
        id: form.id as Id<"loreLibrary"> | undefined,
        title: form.title,
        description: form.description,
        loreType: form.loreType,
        status: form.status || undefined,
        faction: form.faction || undefined,
        sector: form.sector || undefined,
        classification: form.classification || undefined,
        fileStorageId: file ? (file.storageId as Id<"_storage">) : undefined,
        fileMeta: file
          ? { fileName: file.fileName, mimeType: file.mimeType, byteSize: file.byteSize }
          : undefined,
        coverStorageId: cover ? (cover.storageId as Id<"_storage">) : undefined,
        coverMeta: cover
          ? { mimeType: cover.mimeType, byteSize: cover.byteSize, altText: form.title }
          : undefined,
        databaseUrl: form.databaseUrl || undefined,
        databaseName: form.databaseName || undefined,
        featured: form.featured,
      });
      toast.success(form.id ? "Saved." : "Created.");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title={form.id ? "Edit lore item" : "New lore item"} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <FieldRow label="Title" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
        <FieldRow label="Description" value={form.description} onChange={(v) => setForm((f) => ({ ...f, description: v }))} rows={3} maxLength={480} />
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectRow
            label="Type"
            value={form.loreType}
            options={["bible", "image", "database", "map"]}
            onChange={(v) => setForm((f) => ({ ...f, loreType: v as LoreType }))}
          />
          <SelectRow
            label="Status"
            value={form.status}
            options={["draft", "submitted", "approved", "rejected", "archived"]}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
          <FieldRow label="Faction" value={form.faction} onChange={(v) => setForm((f) => ({ ...f, faction: v }))} />
          <FieldRow label="Sector" value={form.sector} onChange={(v) => setForm((f) => ({ ...f, sector: v }))} />
          <FieldRow label="Classification" value={form.classification} onChange={(v) => setForm((f) => ({ ...f, classification: v }))} />
          <label className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-uf-muted pt-5">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
              className="h-4 w-4 accent-[color:var(--uf-cyan)]"
            />
            Featured in library
          </label>
        </div>

        {form.loreType === "database" ? (
          <div className="grid gap-3">
            <FieldRow label="Database name" value={form.databaseName} onChange={(v) => setForm((f) => ({ ...f, databaseName: v }))} />
            <FieldRow
              label="Subdomain URL"
              value={form.databaseUrl}
              onChange={(v) => setForm((f) => ({ ...f, databaseUrl: v }))}
              placeholder="https://fleet.starforce.local"
            />
            <StatusPill variant="gold">Embedded via subdomain · frontend mounted from its own URL</StatusPill>
          </div>
        ) : (
          <UploadRow
            label={
              form.loreType === "image"
                ? "Image file"
                : form.loreType === "map"
                  ? "Map image"
                  : "Bible document"
            }
            hint={
              form.loreType === "image" || form.loreType === "map"
                ? "JPEG · PNG · WebP · AVIF · GIF ≤ 25 MB"
                : "PDF · DOC · DOCX · TXT · MD · images ≤ 25 MB"
            }
            file={file}
            busy={fileBusy}
            inputRef={fileInputRef}
            onPick={() => fileInputRef.current?.click()}
            onFile={(f) => uploadFile(f, setFile, setFileBusy)}
            onClear={() => setFile(null)}
          />
        )}

        <UploadRow
          label="Cover thumbnail"
          hint="Optional · JPEG · PNG · WebP ≤ 5 MB"
          file={cover}
          busy={coverBusy}
          inputRef={coverInputRef}
          onPick={() => coverInputRef.current?.click()}
          onFile={(f) => uploadFile(f, setCover, setCoverBusy)}
          onClear={() => setCover(null)}
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <NeonButton variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </NeonButton>
        <NeonButton variant="primary" onClick={save} loading={busy} disabled={busy}>
          {form.id ? "Save changes" : "Create item"}
        </NeonButton>
      </div>
    </ModalShell>
  );
}

function UploadRow({
  label,
  hint,
  file,
  busy,
  inputRef,
  onPick,
  onFile,
  onClear,
}: {
  label: string;
  hint: string;
  file: Uploaded | null;
  busy: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: () => void;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-3 bg-[rgba(16,24,39,0.35)]">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label={label}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        <NeonButton variant="ghost" onClick={onPick} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}
          {label}
        </NeonButton>
        <span className="text-uf-muted text-[11px] uppercase tracking-[0.16em]">{hint}</span>
      </div>
      {file ? (
        <p className="mt-2 flex items-center justify-between gap-2 rounded-md border border-[color:var(--uf-border)] px-3 py-2 text-sm">
          <span className="flex items-center gap-2 min-w-0 truncate">
            <FileText className="h-4 w-4 text-uf-cyan shrink-0" aria-hidden />
            <span className="truncate">{file.fileName}</span>
            <span className="text-uf-muted shrink-0">({formatBytes(file.byteSize)})</span>
          </span>
          <button type="button" aria-label="Remove" className="text-uf-muted hover:text-uf-red shrink-0" onClick={onClear}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </p>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------------------
// Database frontends
// -------------------------------------------------------------------------

function DatabaseFrontends() {
  const items = useQuery(api.loreLibrary.listAllLoreLibrary, { limit: 100 });
  const databases = useMemo(() => (items ?? []).filter((i) => i.loreType === "database"), [items]);

  return (
    <section aria-label="Database frontends">
      <header className="mb-3">
        <h2 className="text-xl font-semibold">Embedded database frontends</h2>
        <p className="text-uf-muted text-sm mt-1">
          Each database is served from its own subdomain and gets its own
          console page. Open one to mount the URL and inspect its frontend.
        </p>
      </header>
      {items === undefined ? (
        <div className="uf-skeleton" style={{ height: 200 }} />
      ) : databases.length === 0 ? (
        <HoloCard>
          <div className="uf-empty">No databases registered yet.</div>
        </HoloCard>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 list-none p-0 m-0">
          {databases.map((db) => (
            <li key={db._id}>
              <Link
                to={`/operator/lore-library/databases/${db.slug}`}
                className="block group"
              >
                <HoloCard className="h-full transition-transform duration-200 group-hover:-translate-y-0.5">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 h-10 w-10 shrink-0 rounded-md flex items-center justify-center"
                      style={{ color: "var(--uf-cyan)", border: "1px solid rgba(0,229,255,0.35)", background: "rgba(0,229,255,0.08)" }}
                    >
                      <Database className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold group-hover:text-uf-cyan transition-colors">
                        {db.databaseName ?? db.title}
                      </h3>
                      <p className="text-uf-muted text-xs font-mono mt-0.5 truncate">
                        {db.databaseUrl ?? "URL pending"}
                      </p>
                      <p className="text-uf-muted text-sm mt-2 line-clamp-2">
                        {db.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <StatusPill variant={STATUS_TONE[db.status] ?? "default"}>{db.status}</StatusPill>
                        {db.featured ? <StatusPill variant="gold">Featured</StatusPill> : null}
                        {db.classification ? (
                          <StatusPill variant="warning">{db.classification}</StatusPill>
                        ) : null}
                      </div>
                      <span className="inline-flex items-center gap-1.5 mt-3 text-xs uppercase tracking-[0.16em] text-uf-cyan">
                        <Globe2 className="h-3.5 w-3.5" aria-hidden />
                        Open frontend console
                      </span>
                    </div>
                  </div>
                </HoloCard>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// -------------------------------------------------------------------------
// Primitives
// -------------------------------------------------------------------------

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,8,22,0.66)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="uf-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <header className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button type="button" aria-label="Close" className="uf-btn uf-btn--ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  rows,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <label className="block text-xs uppercase tracking-[0.16em] text-uf-muted">
      {label}
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] font-mono"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
        />
      )}
    </label>
  );
}

function SelectRow({
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
    <label className="block text-xs uppercase tracking-[0.16em] text-uf-muted">
      {label}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
