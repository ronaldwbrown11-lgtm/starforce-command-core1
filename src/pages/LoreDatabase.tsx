import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard, NeonButton, StatusPill } from "@/components/uf";
import {
  PersonnelDossierBrowser,
  isPersonnelArchive,
} from "@/components/widgets/PersonnelDossierBrowser";
import { isArmoryArchive } from "@/components/widgets/ArmoryBrowser";
import { ArrowLeft, Database, Ship } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";

// Databases that live inside the main site rather than on a subdomain. These
// open the built-in page instead of embedding a dead external URL.
const BUILT_IN_DATABASES: Record<
  string,
  { label: string; href: string; description: string }
> = {
  "lore-db-sector-atlas": {
    label: "Sector Atlas",
    href: "/map",
    description:
      "Sector charts are built into the site's Star Atlas. Open the interactive map to browse charted space.",
  },
  "lore-db-signal-intel": {
    label: "Signal Vault",
    href: "/vault",
    description:
      "Signal intelligence lives in the Signal Vault. Open the vault to review intercepted transmissions and ARG leads.",
  },
};

// Seed records used placeholder *.starforce.local hosts. Remap any that are
// still stored that way to the real live subdomains so embedded frontends load.
const PLACEHOLDER_HOST_TO_LIVE: Record<string, string> = {
  "personnel.starforce.local": "https://personnel.starforcebase1198.com",
  "armory.starforce.local": "https://armory.starforcebase1198.com",
  "fleet.starforce.local": "https://fleetregistry.starforcebase1198.com",
  "fleetregistry.starforce.local": "https://fleetregistry.starforcebase1198.com",
  "nighthawk.starforce.local": "https://nighthawk.starforcebase1198.com",
};

function resolveDatabaseUrl(item: { databaseUrl?: string | null }): string | null {
  const raw = item.databaseUrl?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith(".starforce.local")) {
      return PLACEHOLDER_HOST_TO_LIVE[u.hostname] ?? null;
    }
  } catch {
    return null;
  }
  return raw;
}

export default function LoreDatabase() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const item = useQuery(api.loreLibrary.loreLibraryBySlug, { slug });

  usePageMeta({
    title: item ? `${item.title} — Star Force 1198` : "Lore database — Star Force 1198",
    description: item?.description ?? undefined,
  });

  if (item === undefined) {
    return (
      <SiteShell>
        <PageHero eyebrow="Lore database" title="Contacting the database…" />
        <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="uf-skeleton" style={{ height: 320 }} />
        </section>
      </SiteShell>
    );
  }

  if (item === null) {
    return (
      <SiteShell>
        <PageHero eyebrow="Lore database" title="Database not found" />
        <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <HoloCard>
            <p className="text-uf-muted text-sm">
              This database record doesn't exist in the Lore Library archive.
            </p>
            <Link to="/lore?tab=databases" className="block mt-4">
              <NeonButton variant="ghost">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to Lore Databases
              </NeonButton>
            </Link>
          </HoloCard>
        </section>
      </SiteShell>
    );
  }

  const isPersonnel = isPersonnelArchive(item);
  const isArmory = isArmoryArchive(item);
  const isFleetRegistry = slug === "lore-db-fleet-registry";
  const builtIn = BUILT_IN_DATABASES[slug];
  const embedUrl = resolveDatabaseUrl(item);
  const eyebrow = [item.faction, "Lore database"].filter(Boolean).join(" • ");

  return (
    <SiteShell>
      <PageHero
        eyebrow={eyebrow}
        title={item.title}
        lead={item.description}
        secondary={{
          label: "Back to Lore Databases",
          href: "/lore?tab=databases",
          variant: "ghost",
        }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="flex flex-wrap items-center gap-2 mb-6">
          <StatusPill variant="info">Database</StatusPill>
          {isPersonnel ? <StatusPill variant="info">Personnel roster</StatusPill> : null}
          {isArmory ? <StatusPill variant="gold">Arsenal manifest</StatusPill> : null}
          {item.classification ? (
            <StatusPill variant="warning">{item.classification}</StatusPill>
          ) : null}
        </header>

        {isPersonnel ? (
          <PersonnelDossierBrowser />
        ) : isFleetRegistry ? (
          <HoloCard>
            <div className="flex items-center gap-3 mb-4">
              <span className="h-10 w-10 rounded-md flex items-center justify-center" style={{ color: "var(--uf-cyan)", border: "1px solid rgba(0,229,255,0.35)", background: "rgba(0,229,255,0.08)" }}>
                <Ship className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{item.databaseName ?? "Fleet Registry"}</p>
                <p className="text-uf-muted text-xs">Official vessel database — now integrated into the main site.</p>
              </div>
            </div>
            <NeonButton variant="primary" onClick={() => window.location.href = "/fleet-registry"}>
              Open the Fleet Registry →
            </NeonButton>
          </HoloCard>
        ) : isArmory ? (
          <HoloCard className="p-0 overflow-hidden">
            <iframe
              src={embedUrl ?? "https://armory.starforcebase1198.com/"}
              title={item.title}
              className="w-full h-[78vh] border-0 bg-[rgba(5,8,22,0.85)]"
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </HoloCard>
        ) : builtIn ? (
          <HoloCard>
            <div className="flex items-center gap-3 mb-4">
              <span
                className="h-10 w-10 rounded-md flex items-center justify-center"
                style={{
                  color: "var(--uf-cyan)",
                  border: "1px solid rgba(0,229,255,0.35)",
                  background: "rgba(0,229,255,0.08)",
                }}
              >
                <Database className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{builtIn.label}</p>
                <p className="text-uf-muted text-xs">{builtIn.description}</p>
              </div>
            </div>
            <NeonButton variant="primary" onClick={() => window.location.href = builtIn.href}>
              Open the {builtIn.label} →
            </NeonButton>
          </HoloCard>
        ) : embedUrl ? (
          <HoloCard className="p-0 overflow-hidden">
            <iframe
              src={`${embedUrl}${embedUrl.includes("?") ? "&" : "?"}embeded=public`}
              title={item.title}
              className="w-full h-[68vh] border-0 bg-[rgba(5,8,22,0.85)]"
            />
          </HoloCard>
        ) : (
          <HoloCard>
            <div className="flex items-center gap-3 mb-4">
              <span
                className="h-10 w-10 rounded-md flex items-center justify-center"
                style={{
                  color: "var(--uf-cyan)",
                  border: "1px solid rgba(0,229,255,0.35)",
                  background: "rgba(0,229,255,0.08)",
                }}
              >
                <Database className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{item.databaseName ?? "Lore database"}</p>
                <p className="text-uf-muted text-xs font-mono">{item.databaseUrl ?? "URL pending"}</p>
              </div>
            </div>
            <div className="rounded-md border border-dashed border-[color:var(--uf-border)] p-10 text-center text-uf-muted text-sm">
              <Database className="h-8 w-8 mx-auto mb-3 opacity-60" aria-hidden />
              This database is embedded via its subdomain. The frontend is
              being deployed — access will appear here once it's live.
            </div>
          </HoloCard>
        )}
      </section>
    </SiteShell>
  );
}
