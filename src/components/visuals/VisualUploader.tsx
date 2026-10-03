import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import {
  ACCEPTED_IMAGE_TYPES,
  formatBytes,
  optimizeImage,
  tierMaxUploadBytes,
  type OptimizedImage,
} from "@/lib/imageTools";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";

// =========================================================================
// VisualUploader — the GLOBAL image upload system, reusable from the Visual
// Forge, Biology Lab, Research Lab, Missions Deck, Species/Technology
// viewers, Character profiles, Storyboards, and Galleries.
//
// Pipeline: pick/drop → auto-resize + optimize (canvas) → thumbnail preview
// → tagging + attribution → submit → Convex storage → createAsset (operators
// publish immediately, members enter the canon approval queue).
// =========================================================================

export type UploaderDefaults = Partial<{
  kind: string;
  medium: string;
  folder: string;
  attribution: string;
  species: string;
  technology: string;
  faction: string;
  mission: string;
  era: string;
  title: string;
}>;

type VisualUploaderProps = {
  defaults?: UploaderDefaults;
  onUploaded?: (result: { id: string; status: string }) => void;
  submitLabel?: string;
  className?: string;
};

const KIND_OPTIONS = [
  "concept",
  "storyboard",
  "portrait",
  "environment",
  "poster",
  "patch",
  "gallery",
  "other",
];
const MEDIUM_OPTIONS = ["Digital", "Ink", "Painting", "Photo", "3D render", "Mixed media"];

type Staged = OptimizedImage & { file: File };

export function VisualUploader({
  defaults,
  onUploaded,
  submitLabel,
  className = "",
}: VisualUploaderProps) {
  const { isAuthenticated, user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<UploaderDefaults>(() => ({
    kind: "concept",
    ...defaults,
  }));
  const [title, setTitle] = useState(defaults?.title ?? "");
  const [description, setDescription] = useState("");
  const [downloadAllowed, setDownloadAllowed] = useState(true);

  const generateUploadUrl = useMutation(api.visuals.generateUploadUrl);
  const createAsset = useMutation(api.visuals.createAsset);

  const set = (key: keyof UploaderDefaults, v: string) =>
    setMeta((m) => ({ ...m, [key]: v }));

  async function handleFile(file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error(
        `Unsupported type (${file.type || "unknown"}). Use JPEG, PNG, WebP, or AVIF.`,
      );
      return;
    }
    // Membership-tier cap (free = 5 MB, cadet+ = more; server re-checks).
    const maxBytes = tierMaxUploadBytes(user);
    if (file.size > maxBytes) {
      toast.error(
        `Image is ${formatBytes(file.size)} — max is ${formatBytes(maxBytes)} for your tier.`,
      );
      return;
    }
    try {
      const optimized = await optimizeImage(file);
      setStaged({ ...optimized, file });
      if (!title) {
        setTitle(file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 120));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't read that image.");
    }
  }

  async function submit() {
    if (!staged) {
      toast.error("Choose an image first.");
      return;
    }
    if (!title.trim()) {
      toast.error("A title is required.");
      return;
    }
    setBusy(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": staged.blob.type || "image/jpeg" },
        body: staged.blob,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
      const { storageId } = (await res.json()) as { storageId: string };
      const result = await createAsset({
        storageId: storageId as Id<"_storage">,
        title: title.trim(),
        description: description || undefined,
        fileName: staged.file.name,
        kind: meta.kind,
        medium: meta.medium,
        folder: meta.folder,
        attribution: meta.attribution,
        species: meta.species,
        technology: meta.technology,
        faction: meta.faction,
        mission: meta.mission,
        era: meta.era,
        downloadAllowed,
      });
      if (!result.ok) throw new Error(result.error);
      toast.success(
        result.status === "approved"
          ? "Published to the canon."
          : "Submitted for canon review.",
      );
      setStaged(null);
      setTitle("");
      setDescription("");
      onUploaded?.({ id: result.id, status: result.status });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const textInput =
    "sf-input w-full rounded-md px-3 py-2 text-sm";

  return (
    <div className={`sf-glass sf-panel-in rounded-xl p-4 sm:p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="uf-eyebrow uf-eyebrow--gold sf-pulse-soft">
          Global uploader
        </span>
        <span className="text-uf-muted sf-deck text-[11px] uppercase tracking-[0.14em]">
          auto-resize · thumbnail · tags
        </span>
      </div>

      {/* Drop zone / picker */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose or drop an image"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        className={`sf-dropzone ${drag ? "sf-dropzone--hot" : ""} rounded-lg p-4 text-center cursor-pointer transition-shadow`}
      >
        {staged ? (
          <div className="flex items-center gap-3 text-left">
            <img
              src={staged.thumbDataUrl}
              alt=""
              className="h-14 w-14 rounded-md border border-[rgba(230,168,23,0.45)] object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {staged.file.name}
              </p>
              <p className="text-uf-muted text-xs">
                {formatBytes(staged.blob.size)}
                {staged.optimized ? " · optimized" : ""}
                {staged.width ? ` · ${staged.width}×${staged.height}` : ""}
              </p>
            </div>
            <button
              type="button"
              className="uf-btn uf-btn--ghost ml-auto text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setStaged(null);
              }}
            >
              <X className="h-4 w-4" aria-hidden /> Remove
            </button>
          </div>
        ) : (
          <p className="text-uf-muted text-sm flex items-center justify-center gap-2">
            <ImagePlus className="h-5 w-5 text-uf-cyan" aria-hidden />
            Drag &amp; drop an image, or click to browse — JPEG · PNG · WebP ·
            AVIF · ≤ 5 MB
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Metadata + tagging */}
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <label className="sm:col-span-2 text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Title *
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="e.g. Vashtar III field sketch"
            className={textInput}
          />
        </label>
        <label className="sm:col-span-2 text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="What does this show? Context for reviewers."
            className={textInput}
          />
        </label>

        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Kind
          <select
            value={meta.kind ?? "concept"}
            onChange={(e) => set("kind", e.target.value)}
            className="sf-select w-full rounded-md px-3 py-2 text-sm"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Medium
          <select
            value={meta.medium ?? ""}
            onChange={(e) => set("medium", e.target.value)}
            className="sf-select w-full rounded-md px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {MEDIUM_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Gallery folder
          <input
            value={meta.folder ?? ""}
            onChange={(e) => set("folder", e.target.value)}
            maxLength={80}
            placeholder="e.g. Corridor 4 sketches"
            className={textInput}
          />
        </label>
        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Era
          <input
            value={meta.era ?? ""}
            onChange={(e) => set("era", e.target.value)}
            maxLength={80}
            placeholder="e.g. Second Expansion"
            className={textInput}
          />
        </label>

        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Species tag
          <input
            value={meta.species ?? ""}
            onChange={(e) => set("species", e.target.value)}
            maxLength={120}
            placeholder="e.g. Vashti"
            className={textInput}
          />
        </label>
        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Technology tag
          <input
            value={meta.technology ?? ""}
            onChange={(e) => set("technology", e.target.value)}
            maxLength={120}
            placeholder="e.g. Phase-Lock Drive"
            className={textInput}
          />
        </label>
        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Faction tag
          <input
            value={meta.faction ?? ""}
            onChange={(e) => set("faction", e.target.value)}
            maxLength={120}
            placeholder="e.g. Star Force"
            className={textInput}
          />
        </label>
        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Mission tag
          <input
            value={meta.mission ?? ""}
            onChange={(e) => set("mission", e.target.value)}
            maxLength={120}
            placeholder="e.g. Operation Nightfall"
            className={textInput}
          />
        </label>

        <label className="text-xs uppercase tracking-[0.16em] sf-label flex flex-col gap-1">
          Artist credit
          <input
            value={meta.attribution ?? ""}
            onChange={(e) => set("attribution", e.target.value)}
            maxLength={80}
            placeholder="Who drew this?"
            className={textInput}
          />
        </label>
        <label className="flex items-end gap-2 text-xs uppercase tracking-[0.16em] sf-label pb-2">
          <input
            type="checkbox"
            checked={downloadAllowed}
            onChange={(e) => setDownloadAllowed(e.target.checked)}
            className="h-4 w-4 accent-[color:var(--uf-gold)]"
          />
          Allow downloads
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!isAuthenticated ? (
          <a href="/auth?returnTo=/canon-images" className="text-uf-cyan text-sm">
            Sign in to submit artwork →
          </a>
        ) : (
          <button
            type="button"
            className="uf-btn uf-btn--gold"
            onClick={() => void submit()}
            disabled={busy || !staged}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />{" "}
                Uploading…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                {submitLabel ?? "Submit for canon"}
              </>
            )}
          </button>
        )}
        {staged ? (
          <span className="text-uf-muted text-xs">
            {title.trim() ? "Ready for review." : "Title required."}
          </span>
        ) : null}
      </div>
    </div>
  );
}
