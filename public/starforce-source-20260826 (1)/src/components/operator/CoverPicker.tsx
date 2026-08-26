import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type CoverKind = "story" | "lore" | "transmission";

export function CoverPicker({
  kind,
  rowId,
  currentStorageId,
  currentUrl,
  onChange,
}: {
  kind: CoverKind;
  rowId?: string;
  currentStorageId?: string | null;
  currentUrl?: string | null;
  /** Called after a successful upload or remove so the parent can refetch. */
  onChange?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const attachStoryCover = useMutation(api.assets.attachStoryCover);
  const removeStoryCover = useMutation(api.assets.removeStoryCover);
  const attachLoreCover = useMutation(api.assets.attachLoreCover);
  const removeLoreCover = useMutation(api.assets.removeLoreCover);
  const attachTransmissionCover = useMutation(api.assets.attachTransmissionCover);
  const removeTransmissionCover = useMutation(api.assets.removeTransmissionCover);

  async function attach(
    storageId: string,
    meta: {
      mimeType: string;
      byteSize: number;
      width?: number;
      height?: number;
      altText?: string;
    },
  ) {
    if (!rowId) throw new Error("Save the entry first.");
    if (kind === "story") {
      await attachStoryCover({ id: rowId as any, storageId: storageId as any, meta });
    } else if (kind === "lore") {
      await attachLoreCover({ id: rowId as any, storageId: storageId as any, meta });
    } else {
      await attachTransmissionCover({
        id: rowId as any,
        storageId: storageId as any,
        meta,
      });
    }
  }

  async function remove() {
    if (!rowId) return;
    try {
      setBusy(true);
      if (kind === "story") await removeStoryCover({ id: rowId as any });
      else if (kind === "lore") await removeLoreCover({ id: rowId as any });
      else await removeTransmissionCover({ id: rowId as any });
      toast.success("Cover removed.");
      onChange?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Remove failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    setError(null);
    if (!rowId) {
      setError("Save the entry first to enable cover upload.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(
        `Image is ${(file.size / (1024 * 1024)).toFixed(1)} MB; max is 5 MB.`,
      );
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(
        `Unsupported type (${file.type}). Allowed: ${ALLOWED_MIME.join(", ")}.`,
      );
      return;
    }

    try {
      setBusy(true);
      const url = await generateUploadUrl({ purpose: `${kind}_cover` });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };
      const sanitizedAlt = file.name
        .replace(/[^a-zA-Z0-9._-]+/g, " ")
        .trim()
        .slice(0, 80);
      const dims = await readImageDimensions(file).catch(() => null);
      await attach(storageId, {
        mimeType: file.type,
        byteSize: file.size,
        width: dims?.w,
        height: dims?.h,
        altText: sanitizedAlt || undefined,
      });
      toast.success("Cover attached.");
      onChange?.();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Upload failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={`Cover image picker (${kind})`}
      className="rounded-md border border-[color:var(--uf-border)] p-4 bg-[rgba(16,24,39,0.55)]"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <span className="uf-eyebrow">Cover image</span>
        {currentStorageId && rowId ? (
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            aria-label="Remove cover"
            className="inline-flex items-center gap-1 text-uf-muted hover:text-uf-red text-xs uppercase tracking-[0.16em] disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
          </button>
        ) : null}
      </header>
      {currentUrl ? (
        <figure
          className="rounded-md overflow-hidden border border-[color:var(--uf-border)] relative"
          aria-label="Current cover"
        >
          <img
            src={currentUrl}
            alt=""
            className="block w-full h-44 object-cover bg-[rgba(16,24,39,0.85)]"
          />
        </figure>
      ) : (
        <div
          className="rounded-md border border-dashed border-[color:var(--uf-border)] h-44 grid place-items-center text-uf-muted text-xs uppercase tracking-[0.16em]"
          aria-label="No cover image"
        >
          No cover image · operator-attached
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_MIME.join(",")}
          disabled={busy || !rowId}
          aria-label="Upload cover image"
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
              <Upload className="h-4 w-4" aria-hidden /> Replace cover
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" aria-hidden /> Upload cover
            </>
          )}
        </button>
        <p className="text-uf-muted text-[11px] uppercase tracking-[0.16em]">
          JPEG · PNG · WebP · AVIF · ≤ 5 MB
        </p>
      </div>
      {!rowId ? (
        <p className="text-uf-muted text-xs mt-2" role="note">
          Save the entry first to enable cover upload.
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

async function readImageDimensions(
  file: File,
): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = { w: img.naturalWidth, h: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(r);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
