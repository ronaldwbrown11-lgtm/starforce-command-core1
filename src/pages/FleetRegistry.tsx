import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Compass, Crosshair, Library, Ship } from "lucide-react";
import {
  SiteShell,
  PageHero,
  GlassPanel,
  HoloCard,
  StatCard,
  StatusPill,
} from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

const FLEET_REGISTRY_URL = "https://fleetregistry.starforcebase1198.com/registry";

// If the subdomain app hasn't signalled onLoad within this window we stop
// showing the skeleton so a slow or blocked uplink never hides the page.
const UPLINK_TIMEOUT_MS = 12_000;

const ARCHIVE_STRIPS = [
  { label: "Hulls & classes", value: "Catalogued", accent: "cyan" as const, href: FLEET_REGISTRY_URL },
  { label: "Service histories", value: "Archived", accent: "violet" as const, href: `${FLEET_REGISTRY_URL}#service-histories` },
  { label: "Armament sheets", value: "Cross-linked", accent: "amber" as const, href: `${FLEET_REGISTRY_URL}#armament-sheets` },
  { label: "Black-box files", value: "Restricted", accent: "magenta" as const, href: `${FLEET_REGISTRY_URL}#black-box-files` },
];

const RELATED = [
  {
    to: "/map",
    icon: Compass,
    accent: "cyan" as const,
    title: "Star Atlas",
    body: "Cross-reference hull assignments against the charted sectors of the Outer Rim and see where the fleet is deployed.",
  },
  {
    to: "/lore",
    icon: Library,
    accent: "violet" as const,
    title: "Canon databases",
    body: "The Armory and personnel archives live beside the fleet registry in the Lore Library — one canon, four archives.",
  },
  {
    to: "/missions",
    icon: Crosshair,
    accent: "amber" as const,
    title: "Mission board",
    body: "Operations log new hulls into the registry as they launch. Follow the board to watch records earn their first patrol.",
  },
];

export default function FleetRegistry() {
  usePageMeta({
    title: "Star Force Fleet Database — Star Force Base 1198",
    description:
      "Explore the official Star Force fleet registry with vessel records, specifications, operational history, and classified lore files.",
  });

  const [uplinkState, setUplinkState] = useState<"linking" | "online" | "delayed">(
    "linking",
  );

  useEffect(() => {
    if (uplinkState !== "linking") return;
    const timer = window.setTimeout(() => {
      setUplinkState((state) => (state === "linking" ? "delayed" : state));
    }, UPLINK_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [uplinkState]);

  const online = uplinkState === "online";

  return (
    <SiteShell>
      <PageHero
        eyebrow="Star Force Command"
        title="FLEET DATABASE"
        lead="Every hull that flies under the Star Force banner is logged here — registry numbers, class specifications, armament, and service history, maintained by Fleet Command in the vehicle archive."
        primary={{
          label: "Open the Star Atlas",
          href: "/map",
          variant: "primary",
        }}
        secondary={{ label: "Canon databases", href: "/lore", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          {ARCHIVE_STRIPS.map((strip) => (
            <a
              key={strip.label}
              href={strip.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block focus-visible:outline-2 focus-visible:outline-[color:var(--uf-cyan)] rounded-xl"
            >
              <StatCard
                label={strip.label}
                value={strip.value}
                accent={strip.accent}
              />
            </a>
          ))}
        </div>

        <GlassPanel accent="cyan" className="overflow-hidden rounded-xl p-0" id="fleet-console">
          {/* Console chrome — decorative brackets are hidden from AT */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10"
          >
            <span className="absolute top-2 left-2 h-5 w-5 border-t-2 border-l-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute top-2 right-2 h-5 w-5 border-t-2 border-r-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-[rgba(0,229,255,0.55)]" />
            <span className="absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-[rgba(0,229,255,0.55)]" />
          </div>

          <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
            <span className="uf-eyebrow mr-auto">Fleet registry // secure uplink</span>
            {uplinkState === "online" ? (
              <StatusPill variant="success">Uplink active</StatusPill>
            ) : uplinkState === "delayed" ? (
              <StatusPill variant="warning">Uplink slow</StatusPill>
            ) : (
              <StatusPill variant="info">Establishing link…</StatusPill>
            )}
            <span className="hidden md:inline font-mono text-[11px] text-uf-muted">
              src: fleetregistry.starforcebase1198.com
            </span>
          </div>

          <div className="relative" aria-busy={uplinkState !== "online"}>
            {!online ? (
              <div
                className="absolute inset-0 z-20 uf-skeleton rounded-none"
                style={{ minHeight: "78vh" }}
              />
            ) : null}
            <iframe
              title="Star Force Fleet Registry"
              src={FLEET_REGISTRY_URL}
              className="relative block w-full border-0 min-h-[78vh] bg-[#050816]"
              loading="eager"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => setUplinkState((state) => (state === "linking" ? "online" : state))}
            />
          </div>

          <div className="relative flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.65)]">
            <Ship className="h-4 w-4 text-uf-cyan shrink-0" aria-hidden />
            <p className="text-xs text-uf-muted">
              Records are maintained by Fleet Command. Submissions and
              corrections route through the Bridge.
            </p>
          </div>
        </GlassPanel>

        {/* Polite status update once the console answers */}
        <p role="status" aria-live="polite" className="sr-only">
          {uplinkState === "online"
            ? "Fleet registry uplink established."
            : uplinkState === "delayed"
              ? "Fleet registry is taking longer than usual to respond."
              : "Connecting to the fleet registry."}
        </p>
      </section>

      <section className="uf-section max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 pb-4">
        <span className="uf-eyebrow">Related archives</span>
        <h2 className="text-xl mt-1 mb-4">One fleet, four archives</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {RELATED.map((item) => (
            <HoloCard key={item.to} as="article" accent={item.accent} className="h-full">
              <Link
                to={item.to}
                className="group flex flex-col h-full focus-visible:outline-2 focus-visible:outline-[color:var(--uf-cyan)] rounded-md"
              >
                <item.icon
                  className="h-5 w-5 text-uf-cyan transition-transform duration-200 group-hover:-translate-y-0.5"
                  aria-hidden
                />
                <h3 className="text-base mt-2">{item.title}</h3>
                <p className="text-uf-muted text-sm mt-1 flex-1">{item.body}</p>
                <span className="uf-eyebrow mt-3 text-[10px]">Open archive →</span>
              </Link>
            </HoloCard>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
