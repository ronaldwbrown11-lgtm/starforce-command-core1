import type { ReactNode } from "react";
import { SiteShell } from "./SiteShell";
import { PageHero } from "./PageHero";
import { HoloCard } from "./Panel";

export type LegalSection = {
  heading: string;
  body: ReactNode;
};

type Palette = "cyan-violet" | "amber-magenta" | "emerald-cyan" | "sapphire" | "magenta-gold" | "void";

/**
 * Shared layout for static legal pages — themed hero + sectioned cards.
 * Content lives in the page files (Privacy, Terms) so they can't drift.
 */
export function LegalPage({
  bgPalette = "sapphire",
  eyebrow,
  title,
  lead,
  updated,
  sections,
}: {
  bgPalette?: Palette;
  eyebrow: string;
  title: string;
  lead: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <SiteShell>
      <PageHero eyebrow={eyebrow} title={title} lead={lead} />
      <section className="uf-section max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-uf-muted text-xs uppercase tracking-[0.16em] mb-6">
          Last updated: {updated}
        </p>
        <div className="flex flex-col gap-4 pb-16">
          {sections.map((s) => (
            <HoloCard key={s.heading}>
              <h2 className="text-xl font-semibold mb-2">{s.heading}</h2>
              <div className="text-sm text-uf-muted space-y-3 leading-relaxed">
                {s.body}
              </div>
            </HoloCard>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
