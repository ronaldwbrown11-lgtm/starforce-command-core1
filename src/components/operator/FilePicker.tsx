import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

// Video files for transmissions.
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const VIDEO_ACCEPT = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

// Documents for resources.
const DOC_MAX_BYTES = 25 * 1024 * 1024;
const DOC_ACCEPT = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

type FileKind = "video" | "document";

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function FilePicker({
  kind,
  rowId,
  currentStorageId,
  currentFileName,
  currentUrl,
  currentByteSize,
  onChange,
}: {
  kind: FileKind;
  rowId?: string;
  currentStorageId?: string | null;
  currentFileName?: string | null;
  currentUrl?: string | null;
  currentByteSize?: number | null;
  /** Called after a successful upload or remove so the parent can refetch. */
  onChange?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const attachTransmissionFile = useMutation(api.assets.attachTransmissionFile);
  const removeTransmissionFile = useMutation(api.assets.removeTransmissionFile);
  const attachResourceFile = useMutation(api.assets.attachResourceFile);
  const removeResourceFile = useMutation(api.assets.removeResourceFile);

  const maxBytes = kind === "video" ? VIDEO_MAX_BYTES : DOC_MAX_BYTES;
  const allowed = kind === "video" ? VIDEO_ACCEPT : DOC_ACCEPT;
  const label = kind === "video" ? "Video file" : "Document file";
  const hint =
    kind === "video"
      ? "MP4 · WebM · OGG · MOV · ≤ 200 MB"
      : "PDF · DOC · DOCX · TXT · MD · images · ≤ 25 MB";

  async function attach(storageId: string, meta: Record<string, unknown>) {
    if (!rowId) throw new Error("Save the entry first.");
    if (kind === "video") {
      await attachTransmissionFile({
        id: rowId as any,
        storageId: storageId as any,
        meta: meta as any,
      });
    } else {
      await attachResourceFile({
        id: rowId as any,
        storageId: storageId as any,
        meta: meta as any,
      });
    }
  }

  async function remove() {
    if (!rowId) return;
    try {
      setBusy(true);
      if (kind === "video") await removeTransmissionFile({ id: rowId as any });
      else await removeResourceFile({ id: rowId as any });
      toast.success("File removed.");
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    if (!rowId) {
      setError("Save the entry first to enable file upload.");
      return;
    }
    if (file.size > maxBytes) {
      setError(
        `File is ${formatBytes(file.size)}; max is ${formatBytes(maxBytes)}.`,
      );
      return;
    }
    if (!allowed.includes(file.type)) {
      setError(
        `Unsupported type (${file.type || "unknown"}). Allowed: ${allowed.join(", ")}.`,
      );
      return;
    }

    try {
      setBusy(true);
      const url = await generateUploadUrl({ purpose: `${kind}_file` });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };
      await attach(storageId, {
        fileName: file.name.replace(/[^\w.\- ]+/g, "").slice(0, 120) || file.name,
        mimeType: file.type,
        byteSize: file.size,
      });
      toast.success(kind === "video" ? "Video attached." : "Document attached.");
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={`${label} picker (${kind})`}
      className="rounded-md border border-[color:var(--uf-border)] p-4 bg-[rgba(16,24,39,0.55)]"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <span className="uf-eyebrow">{label}</span>
        {currentStorageId && rowId ? (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            aria-label="Remove file"
            className="inline-flex items-center gap-1 text-uf-muted hover:text-uf-red text-xs uppercase tracking-[0.16em] disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
          </button>
        ) : null}
      </header>

      {currentUrl ? (
        <div className="rounded-md border border-[color:var(--uf-border)] p-3 bg-[rgba(16,24,39,0.85)]">
          <p className="flex items-center gap-2 text-sm font-medium break-all">
            <FileText className="h-4 w-4 text-uf-cyan shrink-0" aria-hidden />
            {currentFileName || "Uploaded file"}
          </p>
          <p className="text-uf-muted text-xs mt-1">
            {currentByteSize ? formatBytes(currentByteSize) : ""}
            {kind === "video" ? " · plays inline on the channel" : " · linked on the Resources page"}
          </p>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="uf-btn uf-btn--ghost mt-2 text-xs"
          >
            Open file
          </a>
        </div>
      ) : (
        <div
          className="rounded-md border border-dashed border-[color:var(--uf-border)] h-20 grid place-items-center text-uf-muted text-xs uppercase tracking-[0.16em]"
          aria-label="No file uploaded"
        >
          No file · operator-attached
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={allowed.join(",")}
          disabled={busy || !rowId}
          aria-label={`Upload ${label.toLowerCase()}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <button
          type="button"
          disabled={busy || !rowId}
          onClick={() => fileRef.current?.click()}
          className="uf-btn uf-btn--primary text-sm disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading…
            </>
          ) : currentUrl ? (
            <>
              <Upload className="h-4 w-4" aria-hidden /> Replace file
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" aria-hidden /> Upload file
            </>
          )}
        </button>
        <p className="text-uf-muted text-[11px] uppercase tracking-[0.16em]">{hint}</p>
      </div>

      {!rowId ? (
        <p className="text-uf-muted text-xs mt-2" role="note">
          Save the entry first to enable file upload.
        </p>
      ) : null}
      {error ? (
        <p className="text-uf-red text-xs mt-2" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
