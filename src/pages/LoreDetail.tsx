import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  SiteShell,
  PageHero,
  HoloCard,
  NeonButton,
  StatusPill,
} from "@/components/uf";
import { LiveComments } from "@/components/widgets/LiveComments";
import { ReactionBar } from "@/components/widgets/ReactionBar";
import {
  PersonnelDossierBrowser,
  isPersonnelArchive,
} from "@/components/widgets/PersonnelDossierBrowser";
import { BookOpenText, Database, Download, FileText, ImageIcon } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import type { Doc } from "@/convex/_generated/dataModel";

type LibraryItem = Doc<"loreLibrary"> & {
  fileUrl: string | null;
  coverUrl: string | null;
};

export default function LoreDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const libraryItem = useQuery(api.loreLibrary.loreLibraryBySlug, { slug });
  const entry = useQuery(api.content.loreBySlug, { slug });
  const metaTitle = libraryItem?.title ?? entry?.title ?? null;

  usePageMeta({
    title: metaTitle ? `${metaTitle} — Star Force 1198` : "Lore — Star Force 1198",
    description: libraryItem?.description ?? entry?.excerpt ?? undefined,
  });

  if (libraryItem === undefined && entry === undefined) {
    return (
      <SiteShell>
        <PageHero eyebrow="Lore" title="Loading entry…" />
        <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="uf-skeleton" style={{ height: 280 }} />
        </section>
      </SiteShell>
    );
  }

  if (libraryItem) {
    return <LibraryItemView item={libraryItem} />;
  }

  if (entry === null || entry === undefined) {
    return (
      <SiteShell>
        <PageHero
          eyebrow="Out of range"
          title="Lore entry not found"
          lead="The records you're looking for aren't in the archive."
          primary={{ label: "Browse lore", href: "/lore", variant: "primary" }}
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <PageHero
        eyebrow={[entry.faction, entry.sector].filter(Boolean).join(" • ") || "Archive"}
        title={entry.title}
        lead={entry.excerpt}
        primary={{ label: "Continue reading", href: "#entry", variant: "primary" }}
        secondary={{ label: "Back to lore", href: "/lore", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <article
          id="entry"
          className="uf-panel p-6 md:p-10"
          aria-label={`Lore entry: ${entry.title}`}
        >
          <header className="flex flex-wrap items-center gap-2 mb-4">
            {entry.faction ? <StatusPill variant="info">{entry.faction}</StatusPill> : null}
            {entry.sector ? <StatusPill variant="violet">{entry.sector}</StatusPill> : null}
            {entry.classification ? (
              <StatusPill variant="warning">{entry.classification}</StatusPill>
            ) : null}
            {entry.entryType ? (
              <StatusPill variant="default">{entry.entryType}</StatusPill>
            ) : null}
          </header>
          <div className="text-base leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </div>
          {entry.era ? (
            <p className="mt-4 text-xs text-uf-muted uppercase tracking-[0.16em]">
              Era: {entry.era}
            </p>
          ) : null}
        </article>
        <div className="mt-6">
          <ReactionBar targetId={entry._id} targetType="lore" />
        </div>
        <div className="mt-8">
          <LiveComments postId={entry._id} parentType="lore" limit={20} />
        </div>
      </section>
    </SiteShell>
  );
}

// -------------------------------------------------------------------------
// Lore library items — bibles / images / databases
// -------------------------------------------------------------------------

function LibraryItemView({ item }: { item: LibraryItem }) {
  usePageMeta({
    title: `${item.title} — Star Force 1198`,
    description: item.description ?? undefined,
  });

  const isImage = item.loreType === "image";
  const isBible = item.loreType === "bible";
  const isDatabase = item.loreType === "database";
  const file = item.fileUrl;
  const isPdf = item.fileMeta?.mimeType === "application/pdf";
  const eyebrow = [item.faction, item.sector].filter(Boolean).join(" • ") || "Lore Library";

  const TypeIcon = isImage ? ImageIcon : isDatabase ? Database : BookOpenText;

  return (
    <SiteShell>
      <PageHero
        eyebrow={eyebrow}
        title={item.title}
        lead={item.description}
        secondary={{ label: "Back to library", href: "/lore", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="flex flex-wrap items-center gap-2 mb-6">
          <StatusPill variant="info">
            {isImage ? "Image plate" : isDatabase ? "Database" : "Lore bible"}
          </StatusPill>
          {isDatabase && isPersonnelArchive(item) ? (
            <StatusPill variant="info">Personnel roster</StatusPill>
          ) : null}
          {item.classification ? (
            <StatusPill variant="warning">{item.classification}</StatusPill>
          ) : null}
          {item.featured ? <StatusPill variant="gold">Featured</StatusPill> : null}
        </header>

        {isImage ? (
          <HoloCard className="p-0 overflow-hidden">
            {file ? (
              <img
                src={file}
                alt={item.title}
                className="w-full max-h-[70vh] object-contain bg-black/40"
              />
            ) : item.coverUrl ? (
              <img
                src={item.coverUrl}
                alt={item.title}
                className="w-full max-h-[70vh] object-contain bg-black/40"
              />
            ) : (
              <div className="h-72 flex items-center justify-center text-uf-muted">
                <ImageIcon className="h-10 w-10" aria-hidden />
              </div>
            )}
          </HoloCard>
        ) : isBible ? (
          <div className="uf-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-md flex items-center justify-center" style={{ color: "var(--uf-cyan)", border: "1px solid rgba(0,229,255,0.35)", background: "rgba(0,229,255,0.08)" }}>
                  <BookOpenText className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    {item.fileMeta?.fileName ?? "Document pending upload"}
                  </p>
                  <p className="text-uf-muted text-xs">
                    {item.fileMeta ? formatBytes(item.fileMeta.byteSize) : "Operators are preparing this file."}
                  </p>
                </div>
              </div>
              {file ? (
                <a href={file} target="_blank" rel="noreferrer" download={item.fileMeta?.fileName}>
                  <NeonButton variant="primary">
                    <Download className="h-4 w-4" aria-hidden />
                    Download
                  </NeonButton>
                </a>
              ) : null}
            </div>
            {file ? (
              isPdf ? (
                <iframe
                  src={file}
                  title={item.title}
                  className="w-full h-[72vh] rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)]"
                />
              ) : (
                <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-10 text-center text-uf-muted text-sm">
                  <FileText className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
                  This document can't be previewed inline. Use the download
                  button to open <strong>{item.fileMeta?.fileName}</strong>.
                </div>
              )
            ) : (
              <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-10 text-center text-uf-muted text-sm">
                <FileText className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
                The file for this bible hasn't been uploaded yet. Check back
                soon — operators are processing the vault.
              </div>
            )}
          </div>
        ) : isDatabase && isPersonnelArchive(item) ? (
          <PersonnelDossierBrowser />
        ) : (
          <HoloCard>
            <div className="flex items-center gap-3 mb-4">
              <span className="h-10 w-10 rounded-md flex items-center justify-center" style={{ color: "var(--uf-cyan)", border: "1px solid rgba(0,229,255,0.35)", background: "rgba(0,229,255,0.08)" }}>
                <Database className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{item.databaseName ?? "Lore database"}</p>
                <p className="text-uf-muted text-xs font-mono">{item.databaseUrl ?? "URL pending"}</p>
              </div>
            </div>
            {item.databaseUrl ? (
              <iframe
                src={item.databaseUrl}
                title={item.title}
                className="w-full h-[68vh] rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.85)]"
              />
            ) : (
              <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-10 text-center text-uf-muted text-sm">
                <TypeIcon className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
                This database is embedded via its subdomain. The frontend is
                being deployed — access will appear here once it's live.
              </div>
            )}
          </HoloCard>
        )}

        <div className="mt-8">
          <div className="mt-6">
            <ReactionBar targetId={item._id} targetType="lore" />
          </div>
          <LiveComments postId={item._id} parentType="lore" limit={20} />
        </div>
      </section>
    </SiteShell>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
