import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ImagePlus, Loader2, X } from "lucide-react";

// =========================================================================
// ImageUploadField — the upload widget behind the Creator Lab "Images"
// group (Biology Lab portrait/habitat, Research Lab blueprint/device).
//
// One field, two ways to fill it:
//   1. Upload a file — browser POSTs straight to Convex storage via a
//      short-lived upload URL, the finalize step validates it, and the
//      returned stable /lab-image/<storageId> URL lands in the field.
//   2. Paste any http(s) URL — the classic path, kept as a fallback so
//      seeded rows and external canon art still work.
//
// Orphan control: every URL uploaded in this session is remembered, and if
// the value later moves away from it (Clear button, paste-over, form reset)
// we ask the server to discard it. discardImage refuses anything still
// referenced by a row, so the post-submit reset is a safe no-op.
//
// The field value stays a plain URL string, so LabWorkbench's submit,
// dossier rendering, and CSV seeding are all unchanged.
// =========================================================================

// Keep in sync with COVER_MAX_BYTES / COVER_MIME_TYPES in src/convex/assets.ts
// (duplicated here so this component stays a pure frontend import).
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type ImageUploadFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Signed-out visitors can only paste URLs (the form itself is auth-gated). */
  disabled?: boolean;
};

export function ImageUploadField({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: ImageUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Tracks a URL whose preview failed to load so we don't show a broken img.
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.labs.generateImageUploadUrl);
  const finalizeImageUpload = useMutation(api.labs.finalizeImageUpload);
  const discardImage = useMutation(api.labs.discardImage);

  // URLs this widget uploaded this session → their storage ids.
  const uploadsRef = useRef<Map<string, string>>(new Map());
  const valueRef = useRef(value);

  // When the value moves off a URL we uploaded this session, discard it.
  // Covers Clear, paste-over, replacement, the "Clear form" button, and the
  // post-submit reset (where the server reports removed:false — referenced).
  useEffect(() => {
    const prev = valueRef.current;
    valueRef.current = value;
    if (!prev || prev === value) return;
    const storageId = uploadsRef.current.get(prev);
    if (!storageId) return;
    uploadsRef.current.delete(prev);
    // Expected outcomes (unauthenticated / still referenced) come back as
    // { removed: false }; only genuine storage failures reject, and there is
    // nothing actionable the form can do about those mid-edit.
    void discardImage({ storageId: storageId as Id<"_storage"> }).catch(
      () => undefined,
    );
  }, [value, discardImage]);

  const isHttp = /^https?:\/\//i.test(value);
  const showPreview = isHttp && value !== brokenSrc;

  async function handleFile(file: File) {
    if (disabled || busy) return;
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error(
        `Image is ${(file.size / (1024 * 1024)).toFixed(1)} MB — max is 5 MB.`,
      );
      return;
    }
    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      toast.error(
        `Unsupported type (${file.type || "unknown"}). Use JPEG, PNG, WebP, or AVIF.`,
      );
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
      const { storageId } = (await res.json()) as { storageId: string };
      const { url } = await finalizeImageUpload({
        storageId: storageId as Id<"_storage">,
      });
      uploadsRef.current.set(url, storageId);
      setBrokenSrc(null);
      onChange(url);
      toast.success("Image uploaded and attached.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.16em] sf-label">{label}</span>

      <div className="flex items-stretch gap-2">
        <input
          value={value}
          onChange={(e) => {
            setBrokenSrc(null);
            onChange(e.target.value);
          }}
          type="text"
          disabled={disabled}
          placeholder={placeholder ?? "https://… or upload a file"}
          aria-label={label}
          className="sf-input flex-1 min-w-0 rounded-md px-3 py-2 text-sm"
        />
        {showPreview ? (
          <img
            src={value}
            alt=""
            loading="lazy"
            onError={() => setBrokenSrc(value)}
            className="h-10 w-10 shrink-0 rounded-md border border-[rgba(230,168,23,0.45)] object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_MIME_TYPES.join(",")}
          className="sr-only"
          disabled={disabled || busy}
          aria-label={`Upload image for ${label}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className="uf-btn uf-btn--primary sf-deck text-xs disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" aria-hidden /> Upload image
            </>
          )}
        </button>
        {value && !disabled ? (
          <button
            type="button"
            onClick={() => {
              setBrokenSrc(null);
              onChange(""); // effect discards a session upload from here
            }}
            className="uf-btn uf-btn--ghost sf-deck text-xs"
          >
            <X className="h-4 w-4" aria-hidden /> Clear
          </button>
        ) : null}
        <span className="text-uf-muted sf-deck text-[11px] uppercase tracking-[0.14em]">
          JPEG · PNG · WebP · AVIF · ≤ 5 MB
        </span>
      </div>

      <p
        className="text-uf-muted text-[11px]"
        role={busy ? "status" : undefined}
      >
        {busy
          ? "Storing in the archive…"
          : "Upload a file, or paste an image URL."}
      </p>
    </div>
  );
}
