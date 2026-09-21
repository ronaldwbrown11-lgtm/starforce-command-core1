import { SiteShell, PageHero, HoloCard, NeonButton } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import { FirstWatchPanel } from "@/components/widgets/FirstWatchPanel";
import { Link } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import {
  CheckCircle2,
  Compass,
  FileText,
  Gem,
  Medal,
  PenLine,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";

// ---------------------------------------------------------------------------
// First Watch — the new-cadet activation guide.
//
// Seven in-universe sections: activation, first objective (Orientation), the
// Star Atlas, first lore entry, faction choice, first artifact, and the
// journey ahead. Each section pairs its copy with a real destination on the
// base so every objective is one click away.
// ---------------------------------------------------------------------------

type Objective = {
  n: string;
  title: string;
  body: string;
  cta: { label: string; href: string };
};

const OBJECTIVES: Objective[] = [
  {
    n: "01",
    title: "Complete your Orientation Mission",
    body: "It teaches you how to explore the Star Atlas, create your first lore entry, understand your Service Record, and earn your first artifact. A few minutes, and your next phase of training unlocks.",
    cta: { label: "Open the mission board", href: "/missions" },
  },
  {
    n: "02",
    title: "Visit at least three worlds",
    body: "Click any world and you'll find characters, events, artifacts, history, and cadet-created lore. Every planet is a doorway into the universe — every click expands your knowledge, and your opportunities.",
    cta: { label: "Chart the Star Atlas", href: "/map" },
  },
  {
    n: "03",
    title: "Create one entry",
    body: "A character, a planet, a species, a relic, a starship, an event — whatever inspires you. Lore creation is the heart of Star Force, and your entry becomes part of the galaxy forever.",
    cta: { label: "File your first entry", href: "/submit" },
  },
  {
    n: "04",
    title: "Choose your faction",
    body: "Read the dossiers and pick the one that feels like home. Star Force: explorers and defenders. G.I.A.: analysts and investigators. Scientific Corps: researchers. Frontier Specialists: scouts. Civilian Guilds: builders and diplomats. Membership unlocks private channels, specialized missions, and cosmetic upgrades.",
    cta: { label: "Read the faction dossiers", href: "/fleet-registry" },
  },
  {
    n: "05",
    title: "Earn your first artifact",
    body: "Artifacts are collectible lore items that mark your journey — earned through missions, exploration, creation, and events. Your first one appears in your Service Record and begins your collection.",
    cta: { label: "See active operations", href: "/missions" },
  },
];

const UNLOCKS = [
  "your Service Record",
  "your Cadet Dashboard",
  "access to the Star Atlas",
  "the ability to create lore",
  "the right to collect artifacts",
  "eligibility to join a faction",
];

const NEXT_STEPS = [
  "faction missions",
  "seasonal events",
  "collaborative arcs",
  "rare artifact hunts",
  "advanced operations",
  "rank progression",
];

const STEP_ICONS = [Medal, Compass, PenLine, Shield, Gem];

export default function FirstWatch() {
  const { isAuthenticated } = useAuth();
  usePageMeta({
    title: "First Watch — Star Force Base 1198",
    description:
      "The new cadet activation guide: complete Orientation, explore the Atlas, create your first lore entry, choose your faction, and earn your first artifact.",
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="New Cadet Orientation"
        title="Your first watch begins."
        lead="Seven sections. Five objectives. One galaxy waiting for you to shape it. This is the fastest path from activation to full service."
        primary={{ label: "Start with Objective 01", href: "/missions", variant: "primary" }}
        secondary={{ label: "Full Cadet Manual", href: "/manual", variant: "ghost" }}
      />

      {/* Live objective tracker — signed-in members see real completion
          state pulled from their account activity, plus the claimable bonus. */}
      {isAuthenticated ? (
        <section className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-12 mt-8">
          <FirstWatchPanel forceShow />
        </section>
      ) : (
        <section className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-12">
          <HoloCard>
            <p className="text-uf-muted text-sm">
              Signed-in cadets see this checklist track itself — each objective
              ticks off automatically as you complete it, and finishing all five
              pays a one-time bonus of <span className="text-uf-text">+200 XP</span> and{" "}
              <span className="text-uf-text">+50★ Star Credits</span>.
            </p>
            <Link to="/auth?returnTo=/first-watch" className="inline-block mt-3">
              <NeonButton variant="primary">Sign in to start your watch</NeonButton>
            </Link>
          </HoloCard>
        </section>
      )}

      {/* Section I — activation */}
      <section className="uf-section max-w-[900px] mx-auto px-4 sm:px-6 lg:px-12">
        <HoloCard>
          <span className="uf-eyebrow flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Section I — Your activation
          </span>
          <h2 className="text-2xl mt-2">Cadet, your account is now active.</h2>
          <p className="text-uf-muted mt-3">
            This means you've officially entered the Star Force galaxy — a living
            universe shaped by the people who explore it.
          </p>
          <p className="text-uf-muted mt-3">Your activation unlocks:</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 list-none p-0 m-0">
            {UNLOCKS.map((u) => (
              <li key={u} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-uf-green mt-0.5 shrink-0" aria-hidden />
                <span>{u}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-lg text-uf-gold font-semibold tracking-wide">
            You're not a visitor. You're part of the galaxy now.
          </p>
        </HoloCard>
      </section>

      {/* Sections II–VI — objectives */}
      <section className="uf-section max-w-[900px] mx-auto px-4 sm:px-6 lg:px-12">
        <header className="mb-6">
          <h2 className="text-2xl font-semibold">Your objectives</h2>
          <p className="text-uf-muted text-sm mt-1 max-w-[60ch]">
            Work them in order. Each one teaches a system you'll use for the rest
            of your service — and each takes only minutes.
          </p>
        </header>
        <div className="flex flex-col gap-5">
          {OBJECTIVES.map((o, i) => {
            const Icon = STEP_ICONS[i % STEP_ICONS.length];
            return (
              <HoloCard key={o.n}>
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-11 h-11 rounded-md grid place-items-center border border-[color:var(--uf-border)] bg-[rgba(0,229,255,0.06)]">
                    <Icon className="h-5 w-5 text-uf-cyan" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-uf-cyan font-semibold">
                      Objective {o.n}
                    </p>
                    <h3 className="text-lg font-semibold mt-1">{o.title}</h3>
                    <p className="text-uf-muted text-sm mt-2">{o.body}</p>
                    <Link to={o.cta.href} className="inline-block mt-3">
                      <NeonButton variant="ghost">{o.cta.label} →</NeonButton>
                    </Link>
                  </div>
                </div>
              </HoloCard>
            );
          })}
        </div>
      </section>

      {/* Section VII — begin your journey */}
      <section className="uf-section max-w-[900px] mx-auto px-4 sm:px-6 lg:px-12">
        <HoloCard>
          <span className="uf-eyebrow flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" aria-hidden /> Section VII — Begin your journey
          </span>
          <h2 className="text-2xl mt-2">Once you've completed all five…</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 list-none p-0 m-0">
            {[
              "completed Orientation",
              "explored the Atlas",
              "created your first entry",
              "chosen your faction",
              "earned your first artifact",
            ].map((c) => (
              <p key={c} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-uf-green shrink-0" aria-hidden />
                {c}
              </p>
            ))}
          </div>
          <p className="text-uf-muted mt-5">
            You're officially ready to begin your service. From here, the galaxy
            opens up:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {NEXT_STEPS.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[color:var(--uf-border)] bg-[rgba(0,229,255,0.05)] px-3 py-1 text-xs text-uf-text"
              >
                {s}
              </span>
            ))}
          </div>
          <p className="mt-6 text-lg text-uf-gold font-semibold tracking-wide">
            Your journey is yours to shape. Your presence matters.
          </p>
          <p className="text-uf-text font-semibold mt-1 flex items-center gap-2">
            <Users className="h-4 w-4 text-uf-cyan" aria-hidden />
            Welcome to Star Force Base 1198.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/activity">
              <NeonButton variant="primary">Enter your Cadet Dashboard</NeonButton>
            </Link>
            <Link to="/manual">
              <NeonButton variant="ghost">Keep the full manual handy</NeonButton>
            </Link>
          </div>
        </HoloCard>
      </section>
    </SiteShell>
  );
}
