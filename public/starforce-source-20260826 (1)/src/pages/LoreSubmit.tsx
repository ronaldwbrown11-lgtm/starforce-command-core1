import { useCallback, useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router";
import { toast } from "sonner";
import { BookOpenText, Database, FileText, ImageIcon, Loader2, X } from "lucide-react";

import { usePageMeta } from "@/hooks/use-page-meta";
const MAX_BYTES = 25 * 1024 * 1024;
const BIBLE_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

type LoreType = "bible" | "image" | "database";

type AttachedFile = {
  storageId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_META: Record<
  LoreType,
  { label: string; hint: string; icon: typeof FileText; accept: string[]; needsFile: boolean }
> = {
  bible: {
    label: "Lore Bible",
    hint: "Canon documents as PDF, DOC, DOCX, TXT, MD — or image scans.",
    icon: BookOpenText,
    accept: BIBLE_MIME,
    needsFile: false,
  },
  image: {
    label: "Lore Image",
    hint: "A deep-field image plate (JPEG, PNG, WebP, AVIF, GIF).",
    icon: ImageIcon,
    accept: IMAGE_MIME,
    needsFile: true,
  },
  database: {
    label: "Lore Database",
    hint: "A database embedded from its subdomain. Provide the frontend URL.",
    icon: Database,
    accept: [],
    needsFile: false,
  },
};

export default function LoreSubmit() {
  const { isAuthenticated } = useAuth();
  const submit = useMutation(api.loreLibrary.submitLore);
  const generateUserUploadUrl = useMutation(api.users.generateUserUploadUrl);

  const [loreType, setLoreType] = useState<LoreType>("bible");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [faction, setFaction] = useState("");
  const [sector, setSector] = useState("");
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [file, setFile] = useState<AttachedFile | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const meta = TYPE_META[loreType];

  const handleFile = useCallback(
    async (f: File) => {
      if (f.size > MAX_BYTES) {
        toast.error(`File is ${(f.size / (1024 * 1024)).toFixed(1)} MB; max 25 MB.`);
        return;
      }
      if (!meta.accept.includes(f.type)) {
        toast.error(
          loreType === "image"
            ? "Unsupported image type. Use JPEG, PNG, WebP, AVIF, or GIF."
            : "Unsupported file type. Use PDF, DOC, DOCX, TXT, MD, or an image.",
        );
        return;
      }
      try {
        setFileBusy(true);
        const url = await generateUserUploadUrl({ purpose: "lore" });
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": f.type },
          body: f,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const { storageId } = (await res.json()) as { storageId: string };
        setFile({
          storageId,
          fileName: f.name,
          mimeType: f.type,
          byteSize: f.size,
        });
        toast.success("File uploaded.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setFileBusy(false);
      }
    },
    [generateUserUploadUrl, meta.accept, loreType],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required.");
    if (!description.trim()) return toast.error("A short description is required.");
    if (loreType === "database" && !databaseUrl.trim()) {
      return toast.error("Lore databases need their subdomain URL.");
    }
    if (meta.needsFile && !file) {
      return toast.error("Lore images need an uploaded image file.");
    }
    setBusy(true);
    try {
      await submit({
        title,
        description,
        loreType,
        faction: faction || undefined,
        sector: sector || undefined,
        fileStorageId: file ? (file.storageId as any) : undefined,
        fileMeta: file
          ? { fileName: file.fileName, mimeType: file.mimeType, byteSize: file.byteSize }
          : undefined,
        databaseUrl: databaseUrl || undefined,
        databaseName: databaseName || undefined,
      });
      toast.success("Submission received. It's in the operator approval queue.");
      setTitle("");
      setDescription("");
      setFaction("");
      setSector("");
      setDatabaseUrl("");
      setDatabaseName("");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }
  usePageMeta({ title: "Submit Lore — Star Force Base 1198", description: "Submit a new lore entry for the Star Force archive.", noindex: false });


  return (
    <SiteShell>
      <PageHero
        eyebrow="Lore Library"
        title="Submit lore."
        lead="Add a lore bible, an image plate, or a database to the vault. Submissions land in the operator approval queue."
        primary={{ label: "Back to the library", href: "/lore", variant: "ghost" }}
      />
      <section className="uf-section max-w-[900px] mx-auto px-4 sm:px-6 lg:px-12">
        {!isAuthenticated ? (
          <HoloCard>
            <p className="text-uf-muted text-sm">
              Sign in to submit lore. <Link to="/auth" className="text-uf-cyan">Open auth</Link>.
            </p>
          </HoloCard>
        ) : (
          <HoloCard>
            <form className="grid gap-4" onSubmit={handleSubmit} data-uf-form="lore-submit">
              <fieldset className="grid gap-2">
                <legend className="text-xs uppercase tracking-[0.16em] text-uf-muted">
                  Lore type
                </legend>
                <div className="grid sm:grid-cols-3 gap-2">
                  {(Object.keys(TYPE_META) as LoreType[]).map((t) => {
                    const m = TYPE_META[t];
                    const Icon = m.icon;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setLoreType(t);
                          setFile(null);
                        }}
                        aria-pressed={loreType === t}
                        className={`flex flex-col items-start gap-2 rounded-md border px-3 py-3 text-left transition-colors ${
                          loreType === t
                            ? "border-[color:var(--uf-cyan)] bg-[rgba(0,229,255,0.08)] shadow-[var(--uf-glow-cyan)]"
                            : "border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.35)] hover:border-[color:var(--uf-cyan)]"
                        }`}
                      >
                        <Icon className="h-4 w-4 text-uf-cyan" aria-hidden />
                        <span className="text-sm font-semibold">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-uf-muted text-xs">{meta.hint}</p>
              </fieldset>

              <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                Description
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={480}
                  required
                  placeholder="What is this lore, and what does it cover?"
                  className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                />
              </label>

              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Faction (optional)
                  <input
                    value={faction}
                    onChange={(e) => setFaction(e.target.value)}
                    placeholder="Terran Reach"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  />
                </label>
                <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                  Sector (optional)
                  <input
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="Sol system-Gemini"
                    className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                  />
                </label>
              </div>

              {loreType === "database" ? (
                <div className="grid gap-3">
                  <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                    Database name
                    <input
                      value={databaseName}
                      onChange={(e) => setDatabaseName(e.target.value)}
                      placeholder="Fleet Registry"
                      className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                    />
                  </label>
                  <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
                    Subdomain URL
                    <input
                      value={databaseUrl}
                      onChange={(e) => setDatabaseUrl(e.target.value)}
                      placeholder="https://fleet.starforce.local"
                      required
                      className="border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] font-mono"
                    />
                  </label>
                  <StatusPill variant="gold">
                    Embedded via subdomain · frontend mounted from its own URL
                  </StatusPill>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-4 bg-[rgba(16,24,39,0.35)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={meta.accept.join(",")}
                      aria-label="Upload lore file"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(f);
                        e.target.value = "";
                      }}
                    />
                    <NeonButton
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={fileBusy}
                    >
                      {fileBusy ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Uploading…
                        </>
                      ) : (
                        <>
                          <FileText className="h-4 w-4" aria-hidden /> Attach file
                        </>
                      )}
                    </NeonButton>
                    <span className="text-uf-muted text-[11px] uppercase tracking-[0.16em]">
                      {loreType === "image" ? "JPEG · PNG · WebP · AVIF · GIF" : "PDF · DOC · DOCX · TXT · MD · images"}
                      {" · ≤ 25 MB"}
                    </span>
                  </div>
                  {file ? (
                    <p
                      className="mt-3 flex items-center justify-between gap-2 rounded-md border border-[color:var(--uf-border)] px-3 py-2 text-sm"
                      role="status"
                    >
                      <span className="flex items-center gap-2 min-w-0 truncate">
                        <FileText className="h-4 w-4 text-uf-cyan shrink-0" aria-hidden />
                        <span className="truncate">{file.fileName}</span>
                        <span className="text-uf-muted shrink-0">
                          ({formatBytes(file.byteSize)})
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label="Remove file"
                        className="text-uf-muted hover:text-uf-red shrink-0"
                        onClick={() => setFile(null)}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </p>
                  ) : null}
                </div>
              )}

              <NeonButton
                variant="primary"
                type="submit"
                loading={busy}
                disabled={busy}
              >
                Submit for approval
              </NeonButton>
            </form>
          </HoloCard>
        )}
        <p className="text-uf-muted text-xs mt-4">
          Approved lore appears in the public library. You can track your
          submissions from your profile's service record.
        </p>
      </section>
    </SiteShell>
  );
}
