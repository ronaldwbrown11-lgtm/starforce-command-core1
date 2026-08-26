import { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { BackgroundInfo, CardCatalogEntry } from "@/convex/siteAppearance";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { CoverPicker } from "@/components/operator/CoverPicker";
import { toast } from "sonner";
import { Check, ExternalLink, ImagePlus, Loader2, Palette, Trash2, Upload } from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — backgrounds are wallpaper-sized
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];

// The public pages an operator can restyle. Detail pages (e.g. "/stories/:slug")
// automatically inherit the background of their section (e.g. "/stories").
const PAGES: { path: string; label: string }[] = [
  { path: "/", label: "Home" },
  { path: "/stories", label: "Stories" },
  { path: "/lore", label: "Lore" },
  { path: "/maps", label: "Maps" },
  { path: "/videos", label: "Videos" },
  { path: "/missions", label: "Missions" },
  { path: "/community", label: "Community" },
  { path: "/forums", label: "Forums" },
  { path: "/members", label: "Members" },
  { path: "/groups", label: "Groups" },
  { path: "/submit", label: "Submit" },
  { path: "/resources", label: "Resources" },
  { path: "/membership", label: "Membership" },
  { path: "/support", label: "Support" },
  { path: "/activity", label: "Activity" },
  { path: "/account", label: "Account" },
  { path: "/search", label: "Search" },
  { path: "/messages", label: "Messages" },
];

export default function OperatorAppearance() {
  const appearance = useQuery(api.siteAppearance.getAppearance);
  // Bump this key after a per-card upload so useQuery refetches the catalog
  // (Convex queries are cache-keyed on their args).
  const [catalogTick, setCatalogTick] = useState(0);
  const catalog = useQuery(api.siteAppearance.listCardCatalog, {
    version: catalogTick,
  });

  return (
    <OperatorShell>
      <header className="mb-6">
        <span className="uf-eyebrow">Operator Console</span>
        <h1 className="text-3xl font-semibold mt-2 flex items-center gap-3">
          <Palette className="h-6 w-6 text-uf-cyan" aria-hidden />
          Appearance
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Restyle the public site without a rebuild: set the art on the
          featured home-page cards, or swap the backdrop of any page.
          Changes go live instantly and are audit-logged.
        </p>
      </header>

      {/* ============ FEATURED CARD ART — HOME PAGE ============ */}
      <section aria-label="Featured card art" className="mb-10">
        <h2 className="text-xl font-semibold mb-1">
          Featured card art — home page
        </h2>
        <p className="text-uf-muted text-sm mb-4 max-w-2xl">
          Only the content shown on the home page appears here: the two
          featured stories, the lore spotlight, and the broadcast lineup.
          Each card keeps its image-on-top / glass-bottom style — upload the
          art for any of them, and cards without an image keep the themed
          gradient.
        </p>
        <div className="flex flex-col gap-7">
          <CardCatalogGroup
            title="Featured stories"
            entries={catalog?.stories}
            kindLabel="featured on the home page"
            onChange={() => setCatalogTick((t) => t + 1)}
          />
          <CardCatalogGroup
            title="Lore spotlight"
            entries={catalog?.lore}
            kindLabel="featured on the home page"
            onChange={() => setCatalogTick((t) => t + 1)}
          />
          <CardCatalogGroup
            title="Transmissions"
            entries={catalog?.transmissions}
            kindLabel="featured on the home page"
            onChange={() => setCatalogTick((t) => t + 1)}
          />
        </div>
      </section>

      {/* ============ PAGE BACKGROUNDS ============ */}
      <section aria-label="Page backgrounds">
        <header className="mb-3">
          <h2 className="text-xl font-semibold">Page backgrounds</h2>
          <p className="text-uf-muted text-sm max-w-2xl">
            Each public page falls back to its own themed nebula when no image
            is set. Detail pages (a story, a lore entry, a mission) inherit
            their section's background — so setting “Stories” also covers
            every individual story.
          </p>
        </header>
        <div className="grid gap-3 md:grid-cols-2">
          {PAGES.map((page) => (
            <HoloCard key={page.path} className="!p-4">
              <BackgroundSlot
                title={page.label}
                subtitle={page.path === "/" ? "Landing page" : page.path}
                current={appearance?.pageBackgrounds[page.path] ?? null}
                path={page.path}
              />
            </HoloCard>
          ))}
        </div>
      </section>
    </OperatorShell>
  );
}

// ---------------------------------------------------------------------------
// Card art gallery
// ---------------------------------------------------------------------------

function CardCatalogGroup({
  title,
  entries,
  kindLabel,
  onChange,
}: {
  title: string;
  entries: CardCatalogEntry[] | undefined;
  kindLabel: string;
  onChange: () => void;
}) {
  return (
    <section aria-label={title}>
      <header className="mb-3 flex items-baseline gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="text-uf-muted text-xs uppercase tracking-[0.16em]">
          {entries?.length ?? "…"} {kindLabel}
        </span>
      </header>
      {entries === undefined ? (
        <HoloCard>
          <div className="uf-skeleton" style={{ height: 140 }} />
        </HoloCard>
      ) : entries.length === 0 ? (
        <div className="uf-empty">No {kindLabel} yet.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {entries.map((entry) => (
            <HoloCard key={entry._id} className="!p-4">
              <CardArtCard entry={entry} onChange={onChange} />
            </HoloCard>
          ))}
        </div>
      )}
    </section>
  );
}

function CardArtCard({
  entry,
  onChange,
}: {
  entry: CardCatalogEntry;
  onChange: () => void;
}) {
  const viewHref =
    entry.kind === "story"
      ? `/stories/${entry.slug}`
      : entry.kind === "lore"
        ? `/lore/${entry.slug}`
        : "/videos";
  return (
    <div>
      <header className="flex items-center gap-3 mb-3">
        <span
          aria-hidden
          className="w-16 h-12 rounded-md border border-[color:var(--uf-border)] overflow-hidden shrink-0 relative block"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,229,255,0.22), rgba(139,92,246,0.22))",
          }}
        >
          {entry.coverUrl ? (
            <img
              src={entry.coverUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" title={entry.title}>
            {entry.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <StatusPill>{entry.kind}</StatusPill>
            {entry.status ? <StatusPill>{entry.status}</StatusPill> : null}
            <a
              href={viewHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-uf-cyan hover:underline"
            >
              <ExternalLink className="h-3 w-3" aria-hidden />
              View
            </a>
          </div>
        </div>
      </header>
      <CoverPicker
        kind={entry.kind}
        rowId={entry._id}
        currentStorageId={entry.coverStorageId}
        currentUrl={entry.coverUrl}
        onChange={onChange}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page background slot
// ---------------------------------------------------------------------------

function BackgroundSlot({
  title,
  subtitle,
  current,
  path,
}: {
  title: string;
  subtitle?: string;
  current: BackgroundInfo | null;
  path: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateUploadUrl = useMutation(api.assets.generateUploadUrl);
  const setPageBackground = useMutation(api.siteAppearance.setPageBackground);
  const clearPageBackground = useMutation(
    api.siteAppearance.clearPageBackground,
  );

  async function handleFile(file: File) {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError(
        `Image is ${(file.size / (1024 * 1024)).toFixed(1)} MB; max is 10 MB.`,
      );
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setError(
        `Unsupported type (${file.type}). Allowed: ${ALLOWED_MIME.join(", ")}.`,
      );
      return;
    }
    setBusy(true);
    try {
      const url = await generateUploadUrl({
        purpose: `page_background:${path}`,
      });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: string };
      const altText = file.name
        .replace(/[^a-zA-Z0-9._-]+/g, " ")
        .trim()
        .slice(0, 80);
      await setPageBackground({
        path,
        meta: {
          storageId: storageId as any,
          mimeType: file.type,
          byteSize: file.size,
          altText: altText || undefined,
        },
      });
      toast.success(`Background set for ${title}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear() {
    setBusy(true);
    try {
      await clearPageBackground({ path });
      toast.success("Background removed — default restored.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{title}</p>
          {subtitle ? (
            <p className="text-uf-muted text-xs break-all">{subtitle}</p>
          ) : null}
        </div>
        {current ? (
          <StatusPill variant="success">
            <Check className="h-3 w-3" aria-hidden />
            Set
          </StatusPill>
        ) : (
          <StatusPill>Default</StatusPill>
        )}
      </header>

      {current?.url ? (
        <figure
          aria-label={`Current background for ${title}`}
          className="rounded-md overflow-hidden border border-[color:var(--uf-border)] relative"
        >
          <img
            src={current.url}
            alt=""
            className="block w-full h-28 object-cover bg-[rgba(16,24,39,0.85)]"
          />
        </figure>
      ) : (
        <div
          aria-label="No custom background"
          className="rounded-md border border-dashed border-[color:var(--uf-border)] h-28 grid place-items-center text-uf-muted text-xs uppercase tracking-[0.16em]"
        >
          Default background
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_MIME.join(",")}
          disabled={busy}
          aria-label={`Upload background for ${title}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          className="sr-only"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="uf-btn uf-btn--primary text-sm disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Uploading…
            </>
          ) : current ? (
            <>
              <Upload className="h-4 w-4" aria-hidden />
              Replace
            </>
          ) : (
            <>
              <ImagePlus className="h-4 w-4" aria-hidden />
              Upload
            </>
          )}
        </button>
        {current ? (
          <NeonButton variant="danger" onClick={handleClear} disabled={busy}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Remove
          </NeonButton>
        ) : null}
      </div>
      <p className="text-uf-muted text-[11px] uppercase tracking-[0.16em] mt-2">
        JPEG · PNG · WebP · AVIF · ≤ 10 MB
      </p>
      {error ? (
        <p className="text-uf-red text-xs mt-2" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}