import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Link } from "react-router";
import {
  Boxes,
  FileDown,
  FileText,
  Gem,
  Package,
  Shield,
} from "lucide-react";
import { HoloCard, NeonButton, StatusPill } from "../uf";

// ---------------------------------------------------------------------------
// Quartermaster's Locker surfaces. Three views of the same data:
//   - MyLocker: the signed-in member's held assets (Collection binder)
//   - LockerManifest: the public catalog of mintable assets (Awards page)
//   - MemberLockerShowcase: another member's public display (profile dossier)
// ---------------------------------------------------------------------------

const KIND_META: Record<string, { icon: typeof Package; label: string; tone: string }> = {
  blueprint: { icon: FileText, label: "Blueprint", tone: "text-uf-cyan" },
  insignia: { icon: Shield, label: "Insignia Patch", tone: "text-uf-violet" },
  manual: { icon: FileText, label: "Tech Manual", tone: "text-[color:var(--uf-gold,#e6a817)]" },
  artifact: { icon: Gem, label: "Artifact", tone: "text-[color:var(--uf-gold,#e6a817)]" },
};

function kindMeta(kind: string) {
  return KIND_META[kind] ?? { icon: Package, label: kind, tone: "text-uf-muted" };
}

export function MyLocker() {
  const items = useQuery(api.honors.myLocker, {});
  return (
    <section aria-labelledby="locker-mine">
      <h2 id="locker-mine" className="uf-eyebrow mb-3">
        Quartermaster's Locker
      </h2>
      {items === undefined ? (
        <HoloCard>
          <div className="uf-skeleton" style={{ height: 120 }} />
        </HoloCard>
      ) : items.length === 0 ? (
        <HoloCard>
          <div className="text-center py-4">
            <Boxes className="h-8 w-8 mx-auto text-uf-muted" aria-hidden />
            <p className="text-uf-muted text-sm mt-2">
              Your Locker is empty. Assets arrive from operations, events, and Bridge
              grants — browse the manifest to see what's out there.
            </p>
            <Link to="/awards#locker" className="inline-block mt-3">
              <NeonButton variant="ghost">View the manifest</NeonButton>
            </Link>
          </div>
        </HoloCard>
      ) : (
        <div className="uf-grid uf-grid--3">
          {items.map((it) => {
            const meta = kindMeta(it.kind);
            const Icon = meta.icon;
            return (
              <HoloCard key={it._id} className="h-full">
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-20 h-20 rounded-md border border-[color:var(--uf-border)] overflow-hidden bg-[rgba(16,24,39,0.6)] grid place-items-center">
                    {it.coverUrl ? (
                      <img src={it.coverUrl} alt={it.name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon className={`h-8 w-8 ${meta.tone}`} aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold">{it.name}</h3>
                      <StatusPill variant="violet">{meta.label}</StatusPill>
                    </div>
                    {it.classification && (
                      <div className="mt-1">
                        <StatusPill variant="danger">{it.classification}</StatusPill>
                      </div>
                    )}
                    <p className="text-sm text-uf-muted mt-2">{it.description}</p>
                    {it.hasFile && <VaultDownload itemId={it.itemId} />}
                  </div>
                </div>
              </HoloCard>
            );
          })}
        </div>
      )}
    </section>
  );
}

function VaultDownload({ itemId }: { itemId: string }) {
  const url = useQuery(api.honors.vaultFileUrl, { itemId });
  if (url === undefined) return null;
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="uf-btn uf-btn--ghost mt-2 text-xs inline-flex items-center gap-1"
    >
      <FileDown className="h-3.5 w-3.5" aria-hidden /> Open payload
    </a>
  );
}

/** Public manifest of active vault items — Awards page. */
export function LockerManifest() {
  const items = useQuery(api.honors.listVaultPublic, {});
  if (items === undefined) {
    return <div className="uf-skeleton" style={{ height: 200 }} aria-hidden />;
  }
  if (items.length === 0) {
    return (
      <HoloCard>
        <div className="flex items-start gap-3">
          <Package className="h-6 w-6 text-uf-muted shrink-0" aria-hidden />
          <div>
            <h3 className="text-lg font-semibold">The Quartermaster is stocking shelves.</h3>
            <p className="text-uf-muted text-sm mt-1">
              No assets have been minted yet. When the first blueprints and insignia patches
              are issued, they'll be cataloged here.
            </p>
          </div>
        </div>
      </HoloCard>
    );
  }
  return (
    <div className="uf-grid uf-grid--3">
      {items.map((it) => {
        const meta = kindMeta(it.kind);
        const Icon = meta.icon;
        return (
          <HoloCard key={it._id} className="h-full">
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-12 h-12 rounded-md border border-[color:var(--uf-border)] overflow-hidden bg-[rgba(16,24,39,0.6)] grid place-items-center">
                  <Icon className={`h-5 w-5 ${meta.tone}`} aria-hidden />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{it.name}</h3>
                  </div>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <StatusPill variant="violet">{meta.label}</StatusPill>
                    {it.classification && <StatusPill variant="danger">{it.classification}</StatusPill>}
                  </div>
                  <p className="text-sm text-uf-muted mt-1">{it.description}</p>
                </div>
              </div>
          </HoloCard>
        );
      })}
    </div>
  );
}

/** Another member's public locker showcase — profile dossier. */
export function MemberLockerShowcase({ userId }: { userId: string }) {
  const items = useQuery(api.honors.memberLocker, { userId: userId as Id<"users"> });
  if (items === undefined) {
    return <div className="uf-skeleton" style={{ height: 100 }} aria-hidden />;
  }
  if (items.length === 0) return null;
  return (
    <section aria-label="Asset showcase" className="mt-6">
      <h3 className="uf-eyebrow mb-3">Quartermaster's Locker — showcase</h3>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 list-none p-0 m-0">
        {items.map((it) => {
          const meta = kindMeta(it.kind);
          const Icon = meta.icon;
          return (
            <li key={it.itemId}>
              <div className="rounded-md border border-[color:var(--uf-border)] overflow-hidden bg-[rgba(16,24,39,0.6)]">
                <div className="h-24 grid place-items-center">
                  {it.coverUrl ? (
                    <img src={it.coverUrl} alt={it.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon className={`h-7 w-7 ${meta.tone}`} aria-hidden />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{it.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-uf-muted">
                    {meta.label}
                    {it.classification ? ` · ${it.classification}` : ""}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
