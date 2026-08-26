import { SiteShell, PageHero } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";

const FLEET_REGISTRY_URL = "https://fleetregistry.starforcebase1198.com/registry";

export default function FleetRegistry() {
  usePageMeta({
    title: "Star Force Fleet Database — Star Force Base 1198",
    description:
      "Explore the official Star Force fleet registry with vessel records, specifications, operational history, and classified lore files.",
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Star Force Command"
        title="FLEET DATABASE"
        lead="Enter the fleet registry for complete vessel records, specifications, armament, and operational history."
      />
      <section className="uf-section max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="uf-panel overflow-hidden rounded-xl border border-[color:var(--uf-border)] bg-[rgba(5,8,22,0.72)]">
          <iframe
            title="Star Force Fleet Registry"
            src={FLEET_REGISTRY_URL}
            className="block w-full border-0 min-h-[78vh] bg-[#050816]"
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </section>
    </SiteShell>
  );
}
