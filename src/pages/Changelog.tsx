import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, HoloCard, StatusPill } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Rocket } from "lucide-react";

export default function Changelog() {
  const entries = useQuery(api.changelog.listChangelog, {});

  usePageMeta({
    title: "Changelog — Star Force 1198",
    description:
      "Release notes and platform updates from the Star Force Base 1198 bridge.",
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Bridge Logs"
        title="What's new at the Base"
        lead="Every platform update, mission drop, and system change — logged by the operators who shipped it."
        secondary={{ label: "Community Hub", href: "/community", variant: "ghost" }}
      />

      <section className="uf-section max-w-[860px] mx-auto px-4 sm:px-6 lg:px-12">
        {entries === undefined ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="uf-skeleton" style={{ height: 140 }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="uf-empty">
            No changelog entries yet — the first update ships soon.
          </div>
        ) : (
          <ol className="relative border-l border-[color:var(--uf-border)] ml-3 list-none p-0 m-0 flex flex-col gap-8">
            {entries.map((e) => (
              <li key={e._id} className="relative pl-8">
                <span
                  aria-hidden
                  className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2"
                  style={{
                    borderColor: "var(--uf-cyan)",
                    background: "rgba(4,9,18,0.95)",
                    boxShadow: "0 0 10px rgba(0,229,255,0.5)",
                  }}
                />
                <HoloCard className="!p-5">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Rocket
                      className="h-4 w-4"
                      style={{ color: "var(--uf-cyan)" }}
                      aria-hidden
                    />
                    <h2 className="text-lg font-semibold">{e.title}</h2>
                    {e.version ? (
                      <StatusPill variant="violet">v{e.version}</StatusPill>
                    ) : null}
                  </div>
                  <p className="text-uf-muted text-xs">
                    {new Date(e.publishedAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                    {e.author ? ` · by ${e.author.displayName}` : ""}
                  </p>
                  <div className="text-sm text-uf-text/85 mt-3 whitespace-pre-wrap leading-relaxed">
                    {e.body}
                  </div>
                </HoloCard>
              </li>
            ))}
          </ol>
        )}
      </section>
    </SiteShell>
  );
}
