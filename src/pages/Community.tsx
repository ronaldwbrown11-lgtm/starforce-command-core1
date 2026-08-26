import { SiteShell, PageHero, HoloCard, NeonButton } from "@/components/uf";
import { ScrollReveal, ScaleReveal } from "@/hooks/use-scroll-reveal";
import { ActivityFeed } from "@/components/widgets/ActivityFeed";
import { TrendingStories } from "@/components/widgets/TrendingStories";
import { OnlineUsers } from "@/components/widgets/OnlineUsers";
import { MemberSpotlight } from "@/components/widgets/MemberSpotlight";
import { CaptainLogPanel } from "@/components/widgets/CaptainLogPanel";
import { Link } from "react-router";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function Community() {
  usePageMeta({
    title: "Community — Star Force Base 1198",
    description: "Join the Star Force command center. Activity feed, groups, forums, and member spotlight — all in one place.",
    jsonLd: { "@type": "WebPage", name: "Star Force Community" },
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Community"
        title="Step inside the command center."
        lead="Your feed, your groups, your forum signal — all in one place."
        primary={{ label: "Enter Command Center", href: "/activity", variant: "primary" }}
        secondary={{ label: "Browse Groups", href: "/groups", variant: "ghost" }}
      />
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="mb-6 flex items-center justify-between gap-3">
          <OnlineUsers />
          <Link to="/forums">
            <NeonButton variant="ghost">Visit the forums</NeonButton>
          </Link>
        </div>
        <div className="uf-grid uf-grid--3">
          <div className="lg:col-span-2">
            <ActivityFeed limit={10} />
          </div>
          <div className="flex flex-col gap-5">
            <MemberSpotlight />
            <TrendingStories limit={5} />
          </div>
        </div>
      </section>
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <CaptainLogPanel limit={3} />
      </section>
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-6">
          <span className="uf-eyebrow">Onboarding</span>
          <h2 className="text-3xl font-semibold mt-2">Welcome aboard.</h2>
          <p className="text-uf-muted text-sm mt-2">
            Three things to try in your first week:
          </p>
        </header>
        <div className="uf-grid uf-grid--3">
          {[
            { t: "Read a story", d: "Twelve minutes through the Starforce Files sets the tone.", cta: "/stories", label: "Open Stories" },
            { t: "Open the lore scanner", d: "Pull a random archive entry from any faction.", cta: "/lore", label: "Open Lore" },
            { t: "Submit your first draft", d: "Editors review within a week; drafts are private.", cta: "/submit", label: "Submit Story" },
          ].map((c, idx) => (
            <ScaleReveal key={c.t} staggerIndex={idx}>
            <HoloCard>
              <span className="uf-eyebrow">Step</span>
              <h3 className="text-xl mt-2 font-semibold">{c.t}</h3>
              <p className="text-uf-muted text-sm mt-2">{c.d}</p>
              <Link to={c.cta}>
                <NeonButton variant="ghost" className="mt-4">{c.label}</NeonButton>
              </Link>
            </HoloCard>
            </ScaleReveal>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
