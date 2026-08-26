import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router";
import { toast } from "sonner";
import { ImageIcon, Loader2, Map as MapIcon, Upload, X } from "lucide-react";

import { usePageMeta } from "@/hooks/use-page-meta";
const MAX_BYTES = 25 * 1024 * 1024;
const MAP_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

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

export default function Maps() {
  const { isAuthenticated } = useAuth();
  const maps = useQuery(api.loreLibrary.listLoreLibrary, { type: "map", limit: 100 });
  const [lightbox, setLightbox] = useState<{ title: string; url: string } | null>(null);

  const approved = useMemo(() => (maps ?? []).filter((m) => m.status === "approved"), [maps]);
  usePageMeta({ title: "Cartography Deck — Star Force Base 1198", description: "Interactive galaxy maps, sector charts, and community cartography tools.", noindex: false });


  return (
    <SiteShell>
      <PageHero
        eyebrow="Cartography"
        title="Lore maps."
        lead="Survey the charts that frame Sector 1198 — submitted by the fleet, vetted by the bridge, and archived for every navigator. Upload your own map and it joins the queue."
        primary={{ label: "Browse the archive", href: "/lore", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <SubmitMapCard isAuthenticated={isAuthenticated} />

        <div className="mt-10 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-uf-cyan" aria-hidden />
            Chart archive
          </h2>
          <StatusPill variant="info">
            {maps === undefined ? "…" : approved.length} charts
          </StatusPill>
        </div>

        {maps === undefined ? (
          <div className="mt-4">
            <div className="uf-skeleton" style={{ height: 240 }} />
          </div>
        ) : approved.length === 0 ? (
          <HoloCard className="mt-4">
            <div className="uf-empty">
              No approved maps yet. Submit the first chart above.
            </div>
          </HoloCard>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
            {approved.map((m) => (
              <li key={m._id}>
                <button
                  type="button"
                  className="block w-full text-left group"
                  onClick={() => m.fileUrl && setLightbox({ title: m.title, url: m.fileUrl })}
                  aria-label={`Open map ${m.title}`}
                >
                  <HoloCard className="h-full transition-transform duration-200 group-hover:-translate-y-0.5">
                    <div
                      className="w-full aspect-[16/10] rounded-md overflow-hidden border border-[color:var(--uf-border)]"
                      style={{
                        background:
                          "radial-gradient(closest-side at 50% 50%, rgba(0,229,255,0.10), transparent 70%), var(--uf-navy)",
                      }}
                    >
                      {m.fileUrl ? (
                        <img
                          src={m.fileUrl}
                          alt={m.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-uf-muted">
                          <ImageIcon className="h-8 w-8 opacity-60" aria-hidden />
                        </div>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold mt-3 group-hover:text-uf-cyan transition-colors">
                      {m.title}
                    </h3>
                    <p className="text-uf-muted text-sm mt-1 line-clamp-2">{m.description}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {m.faction ? <StatusPill variant="default">{m.faction}</StatusPill> : null}
                      {m.sector ? <StatusPill variant="info">{m.sector}</StatusPill> : null}
                      {m.classification ? (
                        <StatusPill variant="warning">{m.classification}</StatusPill>
                      ) : null}
                    </div>
                  </HoloCard>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {lightbox ? (
        <Lightbox
          title={lightbox.title}
          url={lightbox.url}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </SiteShell>
  );
}

function SubmitMapCard({ isAuthenticated }: { isAuthenticated: boolean }) {
  const submit = useMutation(api.loreLibrary.submitLore);
  const generateUserUploadUrl = useMutation(api.users.generateUserUploadUrl);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [faction, setFaction] = useState("");
  const [sector, setSector] = useState("");
  const [file, setFile] = useState<AttachedFile | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAuthenticated) {
    return (
      <HoloCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-uf-muted text-sm">
            Sign in to upload a lore map. It lands in the operator approval queue.
          </p>
          <Link to="/auth?returnTo=/maps">
            <NeonButton variant="primary">Sign in to submit</NeonButton>
          </Link>
        </div>
      </HoloCard>
    );
  }

  async function handleFile(f: File) {
    if (f.size > MAX_BYTES) {
      toast.error(`File is ${(f.size / (1024 * 1024)).toFixed(1)} MB; max 25 MB.`);
      return;
    }
    if (!MAP_MIME.includes(f.type)) {
      toast.error("Unsupported image type. Use JPEG, PNG, WebP, AVIF, or GIF.");
      return;
    }
    try {
      setFileBusy(true);
      const url = await generateUserUploadUrl({ purpose: "lore-map" });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": f.type },
        body: f,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };
      setFile({ storageId, fileName: f.name, mimeType: f.type, byteSize: f.size });
      toast.success("Map uploaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setFileBusy(false);
    }
  }

  async function handleSubmit() {
    if (!title.trim()) return toast.error("Map title is required.");
    if (!description.trim()) return toast.error("A short description is required.");
    if (!file) return toast.error("Attach a map image first.");
    setBusy(true);
    try {
      await submit({
        title,
        description,
        loreType: "map",
        faction: faction.trim() || undefined,
        sector: sector.trim() || undefined,
        fileStorageId: file.storageId as Id<"_storage">,
        fileMeta: {
          fileName: file.fileName,
          mimeType: file.mimeType,
          byteSize: file.byteSize,
        },
      });
      toast.success("Map submitted. It's in the operator approval queue.");
      setTitle("");
      setDescription("");
      setFaction("");
      setSector("");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <HoloCard>
      <div className="flex items-center gap-2 mb-4">
        <Upload className="h-5 w-5 text-uf-cyan" aria-hidden />
        <h2 className="text-lg font-semibold">Submit a lore map</h2>
      </div>
      <div className="grid gap-3">
        <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
          Map title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="The Kestrel Run survey"
            className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
        </label>
        <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={480}
            placeholder="What does this chart show?"
            className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
          />
        </label>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Faction (optional)
            <input
              value={faction}
              onChange={(e) => setFaction(e.target.value)}
              placeholder="Terran Reach"
              className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.16em] text-uf-muted flex flex-col gap-1">
            Sector (optional)
            <input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Sol system-Gemini"
              className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
            />
          </label>
        </div>

        <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-4 bg-[rgba(16,24,39,0.35)]">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={MAP_MIME.join(",")}
              aria-label="Upload map image"
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
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ImageIcon className="h-4 w-4" aria-hidden />
              )}
              {fileBusy ? "Uploading…" : "Attach map image"}
            </NeonButton>
            <span className="text-uf-muted text-[11px] uppercase tracking-[0.16em]">
              JPEG · PNG · WebP · AVIF · GIF · ≤ 25 MB
            </span>
          </div>
          {file ? (
            <p className="mt-3 flex items-center justify-between gap-2 rounded-md border border-[color:var(--uf-border)] px-3 py-2 text-sm">
              <span className="flex items-center gap-2 min-w-0 truncate">
                <ImageIcon className="h-4 w-4 text-uf-cyan shrink-0" aria-hidden />
                <span className="truncate">{file.fileName}</span>
                <span className="text-uf-muted shrink-0">({formatBytes(file.byteSize)})</span>
              </span>
              <button
                type="button"
                aria-label="Remove map"
                className="text-uf-muted hover:text-uf-red shrink-0"
                onClick={() => setFile(null)}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </p>
          ) : null}
        </div>

        <div className="flex justify-end">
          <NeonButton variant="primary" onClick={handleSubmit} loading={busy} disabled={busy}>
            Submit for approval
          </NeonButton>
        </div>
      </div>
    </HoloCard>
  );
}

function Lightbox({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,8,22,0.8)] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="uf-panel w-full max-w-4xl max-h-[90vh] overflow-y-auto p-4">
        <header className="flex items-center justify-between mb-3 gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" aria-label="Close" className="uf-btn uf-btn--ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </header>
        <img src={url} alt={title} className="w-full rounded-md border border-[color:var(--uf-border)]" />
      </div>
    </div>
  );
}
