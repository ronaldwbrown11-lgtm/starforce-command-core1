import { Link } from "react-router";
import {
  Compass,
  Flag,
  Globe2,
  History,
  Rocket,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { PageHero, SectionHeader, SiteShell } from "@/components/uf";
import { ScrollReveal } from "@/hooks/use-scroll-reveal";
import { usePageMeta } from "@/hooks/use-page-meta";

// ===========================================================================
// Universe Overview — the public, high-level introduction to the Ultra Force
// Universe. This page is deliberately static (no queries): it is the copy the
// founder wrote for newcomers and crawlers alike, so it must render instantly
// and survive with zero data behind it.
// ===========================================================================

const SETTING_POINTS = [
  "frontier worlds",
  "megacities",
  "orbital stations",
  "deep space fleets",
  "ancient ruins",
  "hostile territories",
  "unexplored anomalies",
];

const BRANCHES: { name: string; desc: string }[] = [
  {
    name: "Fleet Command",
    desc: "Starships, carriers, escorts, and exploration vessels",
  },
  {
    name: "Ground Division",
    desc: "Planetary forces, marines, and tactical units",
  },
  {
    name: "Intelligence Directorate",
    desc: "Covert operations, signals, and deep space monitoring",
  },
  {
    name: "Science Corps",
    desc: "Research, xenology, engineering, and anomaly study",
  },
  {
    name: "Diplomatic Wing",
    desc: "Negotiations, treaties, and interstellar relations",
  },
];

const FACTIONS: { name: string; desc: string }[] = [
  { name: "The Star Force", desc: "The central interstellar command." },
  {
    name: "The Orion Triangle",
    desc: "The governing body of a 150-star system alliance.",
  },
  {
    name: "The Pirate Syndicate",
    desc: "An organized pirate faction that controls the space between galactic arms known as the Dabin Range.",
  },
  {
    name: "The G.I.A.",
    desc: "The Galactic Intel Agency is the Orion Triangle's official intelligence agency.",
  },
];

const SHIP_CLASSES: { name: string; desc: string }[] = [
  { name: "Stryker-Class Warp Carrier", desc: "Long-range mobile deployment platform and carrier." },
  { name: "Titan-Class Dreadnought", desc: "Heavy capital combatant and line breaker." },
  { name: "Lancer-Class Interstellar Destroyer", desc: "Medium-heavy offensive escort and anti-capital ship combatant." },
  { name: "Vanguard-Class Battleship", desc: "Core fleet engagement and primary artillery platform." },
  { name: "Omega-Class Super Battleship", desc: "Strategic fleet flagship and supreme heavy-firepower asset." },
  { name: "Atlas-Class Assault Transport", desc: "Planetary invasion and troop/equipment delivery vessel." },
  { name: "Scout-Class Corvette", desc: "Fast patrol, system defense, and screen escort." },
  { name: "Capital-Class Fleet Carrier", desc: "Aviation command center and mobile fighter base." },
  { name: "Enforcer-Class Suppression Cruiser", desc: "Area-denial and anti-insurgency warship." },
  { name: "Viper-Class Destroyer", desc: "Fast-attack and anti-submarine/anti-fighter screening vessel." },
  { name: "Sentinel-Class Frigate", desc: "Escort, picket duty, and multi-mission utility vessel." },
  { name: "Swarm-Class Drone Control Vessel", desc: "Automated swarm command and remote-piloted vessel coordinator." },
  { name: "Spectre-Class Ghost Ship", desc: "Stealth reconnaissance and phase-drift infiltration vessel." },
  { name: "Asclepius-Class Medical Ark", desc: "Hospital ship for mass-casualty evacuation and biological containment." },
  { name: "Hephaestus-Class Mobile Repair Dock", desc: "Field maintenance, drydock support, and capital-ship overhaul vessel." },
  { name: "Strike-Class Rapid Assault Battleship", desc: "Vanguard heavy-strike and shock-engagement platform." },
  {
    name: "Galaxy-Class Warp Carrier / Dimensional Interphaser",
    desc: "Strategic warp carrier, dimensional interphaser, and fleet-coordination flagship.",
  },
];

const TECHNOLOGY = [
  "Tachyon wave drives",
  "Warp gates transit systems",
  "Fleet-wide neural networks",
  "Human uploaded companions",
  "Teleporter-fed weapons",
  "Graviton / anti-gravity technology",
  "Teleporter systems",
  "Nanotech",
];

const TIMELINE = [
  { era: "The Seeding", note: "4 million years ago" },
  { era: "The Awakening", note: "mankind's gift world from the Gardeners" },
  { era: "Early colonization" },
  { era: "The Alliance Charter" },
  { era: "The Star Force" },
  { era: "Mapping the Warp Gates" },
  { era: "Vedan War" },
  { era: "The First Axis War" },
  { era: "Dark Force War" },
  { era: "Ultra Force" },
  { era: "The modern era of expansion and discovery" },
];

const ACTIVITIES = [
  "Explore canon stories",
  "Read lore entries",
  "Follow galactic events",
  "Participate in missions",
  "Track fleet activity",
  "Earn honors and achievements",
  "Contribute to lore and worldbuilding",
  "Join factions",
  "Build characters",
  "Engage with the community",
  "And much more!",
];

const START_LINKS: { label: string; to: string }[] = [
  { label: "Visit the Canon Archive", to: "/stories" },
  { label: "Explore the Star Atlas", to: "/map" },
  { label: "Read the Faction Profiles", to: "/factions" },
  { label: "Join the Fleet", to: "/auth" },
  { label: "Participate in Missions", to: "/missions" },
  { label: "Join contests", to: "/contests" },
  { label: "Create your own profile", to: "/account" },
  { label: "Earn your wings and your place on the Honor Wall", to: "/wings" },
  { label: "Add to the lore", to: "/lore/submit" },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-md border border-[color:var(--uf-border)] bg-[rgba(10,22,40,0.5)] px-3 py-1.5 text-sm text-uf-muted">
      {children}
    </li>
  );
}

export default function UniverseOverview() {
  usePageMeta({
    title: "Universe Overview — Star Force Base 1198",
    description:
      "The Ultra Force Universe is a vast, cinematic science fiction world created by Ron Brown — its setting, the Star Force, major factions, starships, and timeline.",
    jsonLd: { "@type": "AboutPage", name: "Ultra Force Universe Overview" },
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Ultra Force Universe"
        title="Universe Overview"
        lead="A vast, cinematic science fiction world created by Ron Brown — its setting, its defenders, and everything waiting inside."
        primary={{ label: "Join the Fleet", href: "/auth", variant: "primary" }}
        secondary={{ label: "Explore the Setting", href: "#setting", variant: "ghost" }}
      />

      {/* =========== INTRO =========== */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <ScrollReveal>
          <div className="uf-card p-6 md:p-8 space-y-4">
            <span className="uf-eyebrow">The Universe</span>
            <p className="text-uf-muted text-sm md:text-base leading-7">
              The Ultra Force Universe is a vast, cinematic science fiction world
              created by Ron Brown. It spans star systems, factions, conflicts,
              technologies, and characters across a far future galaxy shaped by
              exploration, war, diplomacy, and the relentless push of humanity
              into the unknown.
            </p>
            <p className="text-uf-muted text-sm md:text-base leading-7">
              Star Force Base 1198 serves as the central hub of this universe: a
              living archive where canon stories, missions, starship data,
              faction histories, and galactic events are recorded and expanded by
              the community. Artists of all levels and media are encouraged to
              share their talents.
            </p>
            <p className="text-uf-muted text-sm md:text-base leading-7">
              This page provides a high level introduction to the universe, its
              setting, and its core elements.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* =========== SETTING =========== */}
      <section
        id="setting"
        className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12 scroll-mt-24"
      >
        <ScrollReveal>
          <SectionHeader
            eyebrow="Setting"
            title="The 30th Century Galaxy"
            icon={<Globe2 className="h-4 w-4" />}
          />
          <div className="uf-card mt-6 p-6 md:p-8">
            <p className="text-uf-muted text-sm md:text-base leading-7">
              Humanity has spread across the stars, establishing colonies,
              alliances, and military outposts throughout dozens of sectors. The
              galaxy is alive with:
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {SETTING_POINTS.map((point) => (
                <Chip key={point}>{point}</Chip>
              ))}
            </ul>
            <p className="text-uf-muted mt-6 text-sm md:text-base leading-7">
              The Star Force — a unified interstellar defense and exploration
              command — stands at the center of this era. Their mission:
            </p>
            <p className="mt-4 rounded-md border border-[color:var(--uf-border)] px-5 py-4 text-sm md:text-base font-semibold text-center uf-glow-text">
              Protect the galaxy. Expand the frontier. Preserve the legacy of
              humanity.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* =========== THE STAR FORCE =========== */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Organization"
            title="The Star Force"
            icon={<Shield className="h-4 w-4" />}
          />
          <p className="text-uf-muted mt-4 text-sm md:text-base leading-7">
            The Star Force is a multi-branch organization composed of:
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BRANCHES.map((branch) => (
              <div key={branch.name} className="uf-card p-5">
                <h3 className="text-base font-semibold text-uf-cyan">
                  {branch.name}
                </h3>
                <p className="mt-1 text-sm text-uf-muted leading-6">
                  {branch.desc}
                </p>
              </div>
            ))}
          </div>
          <p className="text-uf-muted mt-5 text-sm md:text-base leading-7">
            Every member — from cadet to admiral — contributes to the galaxy's
            stability.
          </p>
        </ScrollReveal>
      </section>

      {/* =========== THE ULTRA FORCE =========== */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Flagship Fleet"
            title="The Ultra Force"
            icon={<Sparkles className="h-4 w-4" />}
          />
          <div
            className="uf-card mt-6 p-6 md:p-8"
            style={{
              background:
                "radial-gradient(700px 300px at 25% 30%, rgba(0,229,255,0.14), transparent 65%), linear-gradient(135deg, rgba(0,229,255,0.08), rgba(139,92,246,0.10))",
            }}
          >
            <p className="text-uf-muted text-sm md:text-base leading-7">
              The Ultra Force is the 1st Inter-Dimensional Fleet of the Star
              Force. Its flagship, the{" "}
              <strong className="font-semibold text-uf-cyan">
                U.S.S. Necromancer (now Matriarch)
              </strong>
              , was responsible for ending the Intergalactic War at the end of
              the screenplay{" "}
              <strong className="font-semibold text-uf-cyan">
                Ultra Force: Mission One
              </strong>
              .
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* =========== MAJOR FACTIONS =========== */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Powers of the Galaxy"
            title="Major Factions"
            icon={<Flag className="h-4 w-4" />}
          />
          <p className="text-uf-muted mt-4 text-sm md:text-base leading-7">
            The galaxy is shaped by powerful groups, each with their own motives:
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FACTIONS.map((faction) => (
              <div key={faction.name} className="uf-card p-5">
                <h3 className="text-base font-semibold text-uf-cyan">
                  {faction.name}
                </h3>
                <p className="mt-1 text-sm text-uf-muted leading-6">
                  {faction.desc}
                </p>
              </div>
            ))}
          </div>
          <p className="text-uf-muted mt-5 text-sm italic">
            There are hundreds of other factions — you are encouraged to{" "}
            <Link to="/factions" className="text-[var(--uf-cyan)] not-italic">
              explore them
            </Link>
            .
          </p>
        </ScrollReveal>
      </section>

      {/* =========== STARSHIPS & TECHNOLOGY =========== */}
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Hardware of the Fleet"
            title="Starships & Technology"
            icon={<Rocket className="h-4 w-4" />}
          />
          <p className="text-uf-muted mt-4 text-sm md:text-base leading-7">
            Starships are the backbone of the Ultra Force Universe. Classes
            include:
          </p>
        </ScrollReveal>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SHIP_CLASSES.map((ship) => (
            <ScrollReveal key={ship.name}>
              <div className="uf-card h-full p-4">
                <h3 className="text-sm font-semibold text-uf-cyan">
                  {ship.name}
                </h3>
                <p className="mt-1 text-xs text-uf-muted leading-5">
                  {ship.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
        <ScrollReveal>
          <p className="text-uf-muted mt-8 text-sm md:text-base leading-7">
            Technology ranges from:
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {TECHNOLOGY.map((item) => (
              <Chip key={item}>{item}</Chip>
            ))}
          </ul>
        </ScrollReveal>
      </section>

      {/* =========== TIMELINE =========== */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="History"
            title="The Timeline"
            icon={<History className="h-4 w-4" />}
          />
          <p className="text-uf-muted mt-4 text-sm md:text-base leading-7">
            The Ultra Force Universe spans centuries of history, including:
          </p>
          <ol className="mt-5 space-y-0">
            {TIMELINE.map((entry, index) => (
              <li key={entry.era} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--uf-cyan)] shadow-[0_0_8px_rgba(0,229,255,0.8)]" />
                  {index < TIMELINE.length - 1 && (
                    <span className="w-px flex-1 bg-[color:var(--uf-border)]" />
                  )}
                </div>
                <div className="pb-6">
                  <span className="text-sm md:text-base font-semibold">
                    {entry.era}
                  </span>
                  {entry.note ? (
                    <span className="text-uf-muted text-sm"> — {entry.note}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="text-uf-muted text-sm italic leading-7">
            A full timeline exists inside the private canon, but this page
            provides the broad strokes needed for public understanding.
          </p>
        </ScrollReveal>
      </section>

      {/* =========== WHAT YOU CAN DO =========== */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
        <ScrollReveal>
          <SectionHeader
            eyebrow="Participation"
            title="What You Can Do in the Universe"
            icon={<Zap className="h-4 w-4" />}
          />
          <p className="text-uf-muted mt-4 text-sm md:text-base leading-7">
            Visitors and members can:
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {ACTIVITIES.map((item) => (
              <Chip key={item}>{item}</Chip>
            ))}
          </ul>
          <p className="text-uf-muted mt-6 text-sm md:text-base leading-7">
            Star Force Base 1198 is a living universe, updated continuously with
            new content.
          </p>
        </ScrollReveal>
      </section>

      {/* =========== START EXPLORING =========== */}
      <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12 pb-20">
        <ScrollReveal>
          <SectionHeader
            eyebrow="First Steps"
            title="Start Exploring"
            icon={<Compass className="h-4 w-4" />}
          />
          <p className="text-uf-muted mt-4 text-sm md:text-base leading-7">
            To begin your journey:
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {START_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="uf-card flex items-center justify-between gap-3 p-4 transition-colors hover:border-[color:var(--uf-cyan)]"
              >
                <span className="text-sm font-medium">{link.label}</span>
                <span aria-hidden className="text-uf-cyan">
                  →
                </span>
              </Link>
            ))}
          </div>
          <p className="text-uf-muted mt-8 text-sm md:text-base leading-7">
            There is so much to do. The Ultra Force Universe is always expanding
            — and you can be part of its future.
          </p>
        </ScrollReveal>
      </section>
    </SiteShell>
  );
}
