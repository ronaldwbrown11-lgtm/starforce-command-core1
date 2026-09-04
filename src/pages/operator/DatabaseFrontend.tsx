import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, NeonButton, StatusPill } from "@/components/uf";
import { toast } from "sonner";
import {
  ArrowLeft,
  Database,
  ExternalLink,
  Globe2,
  Loader2,
  Save,
} from "lucide-react";

const STATUS_TONE: Record<string, "info" | "warning" | "gold" | "default" | "danger"> = {
  approved: "info",
  submitted: "warning",
  draft: "default",
  rejected: "danger",
  archived: "default",
};

export default function OperatorDatabaseFrontend() {
  const { slug } = useParams<{ slug: string }>();
  const items = useQuery(api.loreLibrary.listAllLoreLibrary, { limit: 200 });
  const upsert = useMutation(api.loreLibrary.upsertLoreItem);

  const databases = (items ?? []).filter((i) => i.loreType === "database");
  const db = databases.find((i) => i.slug === slug) ?? null;

  const [name, setName] = useState(db?.databaseName ?? "");
  const [url, setUrl] = useState(db?.databaseUrl ?? "");
  const [saving, setSaving] = useState(false);

  // Keep the editable fields in sync when the selected database changes.
  // Adjusting state during render (no effect needed) so the fields reset the
  // instant the route slug changes.
  const [activeDbId, setActiveDbId] = useState<string | undefined>(db?._id);
  if (activeDbId !== db?._id) {
    setActiveDbId(db?._id);
    setName(db?.databaseName ?? "");
    setUrl(db?.databaseUrl ?? "");
  }

  async function save() {
    if (!db) return toast.error("Database not found.");
    if (!url.trim()) return toast.error("Subdomain URL required.");
    setSaving(true);
    try {
      await upsert({
        id: db._id,
        title: db.title,
        description: db.description,
        loreType: "database",
        status: db.status,
        faction: db.faction ?? undefined,
        sector: db.sector ?? undefined,
        classification: db.classification ?? undefined,
        databaseUrl: url.trim(),
        databaseName: name.trim() || undefined,
        featured: db.featured ?? false,
      });
      toast.success("Database frontend updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OperatorShell>
      <header className="mb-6">
        <Link
          to="/operator/lore-library"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-uf-muted hover:text-uf-cyan transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Lore Library Desk
        </Link>
        <h1 className="text-3xl font-semibold mt-3 flex items-center gap-3">
          <Database className="h-6 w-6 text-uf-cyan" aria-hidden />
          {db ? db.title : "Database frontend"}
        </h1>
        <p className="text-uf-muted text-sm mt-1 max-w-2xl">
          Embedded frontend for this database, served from its own subdomain.
          Update the mount URL here or from the Library tab.
        </p>
      </header>

      <nav className="flex gap-2 mb-6 flex-wrap" aria-label="Database selection">
        {databases.length === 0 ? (
          <span className="text-uf-muted text-sm">
            No databases registered yet.
          </span>
        ) : (
          databases.map((d) => {
            const active = d.slug === slug;
            return (
              <Link
                key={d._id}
                to={`/operator/lore-library/databases/${d.slug}`}
                className={`uf-btn ${active ? "uf-btn--primary" : ""}`}
              >
                <Globe2 className="h-4 w-4" aria-hidden />
                {d.databaseName ?? d.title}
              </Link>
            );
          })
        )}
      </nav>

      {items === undefined ? (
        <div className="uf-skeleton" style={{ height: 320 }} />
      ) : !db ? (
        <HoloCard>
          <div className="uf-empty">
            <Database className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
            No database matches this slug. Create it from the Lore Library
            desk's Library tab, or pick a database above.
          </div>
        </HoloCard>
      ) : (
        <div className="flex flex-col gap-6">
          <HoloCard>
            <header className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {db.databaseName ?? db.title}
                </h2>
                <StatusPill variant={STATUS_TONE[db.status] ?? "default"}>
                  {db.status}
                </StatusPill>
                {db.featured ? <StatusPill variant="gold">Featured</StatusPill> : null}
                {db.classification ? (
                  <StatusPill variant="warning">{db.classification}</StatusPill>
                ) : null}
              </div>
              {db.databaseUrl ? (
                <a
                  href={db.databaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-uf-cyan hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Open fullscreen
                </a>
              ) : null}
            </header>
            <p className="text-uf-muted text-sm mb-3 max-w-2xl">
              {db.description}
            </p>
            {db.databaseUrl ? (
              <iframe
                src={db.databaseUrl}
                title={db.title}
                className="w-full h-[62vh] rounded-md border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.85)]"
              />
            ) : (
              <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-10 text-center text-uf-muted text-sm">
                <Database className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
                No subdomain URL mounted yet. Set it below and save.
              </div>
            )}
          </HoloCard>

          <HoloCard>
            <h3 className="text-base font-semibold mb-3">
              Frontend mount settings
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs uppercase tracking-[0.16em] text-uf-muted">
                Database name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Fleet Registry"
                  className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)]"
                />
              </label>
              <label className="block text-xs uppercase tracking-[0.16em] text-uf-muted">
                Subdomain URL
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://fleetregistry.starforcebase1198.com"
                  className="mt-1 w-full border border-[color:var(--uf-border)] rounded-md px-3 py-2 text-sm bg-[rgba(16,24,39,0.5)] font-mono"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <NeonButton variant="primary" onClick={save} loading={saving} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" aria-hidden />
                )}
                Save frontend
              </NeonButton>
            </div>
          </HoloCard>
        </div>
      )}
    </OperatorShell>
  );
}
