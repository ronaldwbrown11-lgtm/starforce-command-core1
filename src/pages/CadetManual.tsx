import { Download, Sparkles } from "lucide-react";
import { SiteShell, PageHero, HoloCard } from "@/components/uf";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  FRAME_CATALOG,
  TITLE_CATALOG,
  BOOST_CATALOG,
  CREDIT_RATES,
} from "@/lib/economy";

// ---------------------------------------------------------------------------
// New Cadets Manual — the standing orientation document. Covers the base's
// systems in reading order: identity, earning, spending, contributing. The
// six-month growth plan is downloadable as a print-ready PDF.
// ---------------------------------------------------------------------------

const EARNING_ROWS: Array<{ what: string; rate: string }> = [
  { what: "Published story", rate: `${CREDIT_RATES.storyPublished} ★` },
  { what: "Approved lore entry", rate: `${CREDIT_RATES.loreApproved} ★` },
  { what: "Certified discovery", rate: `${CREDIT_RATES.discoveryApproved} ★` },
  { what: "Filed mission report", rate: `${CREDIT_RATES.missionReport} ★` },
  { what: "Community comment", rate: `${CREDIT_RATES.comment} ★` },
  { what: "Cadet Induction quest", rate: "XP + Star Credits" },
  { what: "Contests & vault ciphers", rate: "Varies by event" },
];

const PHASES: Array<{ phase: string; window: string; title: string; items: string[] }> = [
  {
    phase: "Phase 1",
    window: "Months 1–2",
    title: "Make the economy real",
    items: [
      "Cosmetic Lab expansion: titles, boosts, rotation shelf (shipped)",
      "Full-card profile frames (shipped)",
      "Star Credit caches in the Requisition Depot",
      "Aspirational deep-sink items (5,000★+)",
    ],
  },
  {
    phase: "Phase 2",
    window: "Months 2–3",
    title: "Social spending",
    items: [
      "Credit gifting & tipping on stories and lore",
      "Profile display cases for owned cosmetics",
      "Group treasuries with pooled perks",
    ],
  },
  {
    phase: "Phase 3",
    window: "Months 3–4",
    title: "Recurring events drive demand",
    items: [
      "Seasonal Cosmetic Pass with limited editions",
      "Weekly contest entry fees with merch prize pools",
      "Base-wide community goals unlocking canon content",
    ],
  },
  {
    phase: "Phase 4",
    window: "Months 4–5",
    title: "Premium & creators",
    items: [
      "Lore rentals — 48h access to tier-gated archives",
      "Creator program — members sell through the depot",
      "ARG campaigns with credit bounties",
    ],
  },
  {
    phase: "Phase 5",
    window: "Month 6",
    title: "Polish & scale",
    items: [
      "Credit economy dashboard in the operator console",
      "Achievement-linked earned cosmetics",
      "Referral rewards for recruiting active members",
    ],
  },
];

export default function CadetManual() {
  usePageMeta({
    title: "New Cadets Manual — Star Force Base 1198",
    description:
      "The standing orientation manual for new cadets: pilot orientation, ranks, Star Credits, the Cosmetic Lab, boosts, and how to earn your place in the fleet.",
    jsonLd: {
      "@type": "Article",
      name: "New Cadets Manual",
      description: "Orientation manual for Star Force Base 1198",
    },
  });

  return (
    <SiteShell>
      <PageHero
        eyebrow="Orientation"
        title="New Cadets Manual"
        lead="Everything a new recruit needs: how the base runs, how you earn your place, and how your legend is displayed. Read it once; refer to it always."
        primary={{ label: "Start Pilot Orientation", href: "/account", variant: "primary" }}
        secondary={{ label: "Back to base", href: "/", variant: "ghost" }}
      />

      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="uf-grid uf-grid--2">
          <HoloCard>
            <span className="uf-eyebrow">Step 01</span>
            <h2 className="text-xl font-semibold mt-1">Arrive & identify</h2>
            <p className="text-uf-muted text-sm mt-2">
              Sign in with your email and complete Pilot Orientation: choose a
              callsign, a starting rank, and a fleet affiliation, then assign
              your starship through the six-step wizard. Everything is editable
              later from your Account page — nothing you pick now is permanent.
            </p>
            <p className="text-uf-muted text-sm mt-2">
              When orientation finishes, the Cadet Induction quest lights up.
              It walks you through joining a group, reacting to a story, filing
              a report, and earning your first badge — paying out XP and Star
              Credits as you go.
            </p>
          </HoloCard>

          <HoloCard>
            <span className="uf-eyebrow">Step 02</span>
            <h2 className="text-xl font-semibold mt-1">Climb the ranks</h2>
            <p className="text-uf-muted text-sm mt-2">
              XP comes from quests, missions, contests, Signal Vault ciphers,
              and community activity. Ranks climb automatically — Recruit,
              Aspirant at 500 XP, Pilot at 1,500, Commander at 4,000, Captain
              at 9,000, Admiral at 20,000. Paid tiers climb faster through
              their XP multipliers, but every rank is earnable on Free.
            </p>
          </HoloCard>

          <HoloCard>
            <span className="uf-eyebrow">Step 03</span>
            <h2 className="text-xl font-semibold mt-1">Earn Star Credits</h2>
            <p className="text-uf-muted text-sm mt-2">
              Credits are the fleet's merit currency. The faucet:
            </p>
            <ul className="list-none p-0 m-0 mt-2 text-sm">
              {EARNING_ROWS.map((r) => (
                <li
                  key={r.what}
                  className="flex items-center justify-between gap-3 border-b border-[color:var(--uf-border)] py-1.5 last:border-0"
                >
                  <span className="text-uf-muted">{r.what}</span>
                  <span className="font-mono" style={{ color: "var(--uf-gold)" }}>{r.rate}</span>
                </li>
              ))}
            </ul>
            <p className="text-uf-muted text-sm mt-3">
              Your balance lives on your Account page; standings show on the
              leaderboard.
            </p>
          </HoloCard>

          <HoloCard>
            <span className="uf-eyebrow">Step 04</span>
            <h2 className="text-xl font-semibold mt-1">The Cosmetic Lab</h2>
            <p className="text-uf-muted text-sm mt-2">
              Credits become style in the Lab on your Account page — three
              departments, all cosmetic, none of it affecting approvals or
              standing.
            </p>
            <p className="text-sm mt-2 font-semibold">Frames</p>
            <p className="text-uf-muted text-sm">
              A holographic ring around your whole profile card and header
              badge:{" "}
              {Object.values(FRAME_CATALOG)
                .map((f) => `${f.label} (${f.cost.toLocaleString()} ★)`)
                .join(" · ")}
              .
            </p>
            <p className="text-sm mt-2 font-semibold">Titles</p>
            <p className="text-uf-muted text-sm">
              Name flairs beside your callsign on profiles and bylines:{" "}
              {Object.values(TITLE_CATALOG)
                .filter((t) => t.cost !== null)
                .map((t) => `${t.label} (${t.cost?.toLocaleString()} ★)`)
                .join(" · ")}
              . Fleet Honor and Signal Legend are command awards — never
              purchasable.
            </p>
            <p className="text-sm mt-2 font-semibold">Boosts</p>
            <p className="text-uf-muted text-sm">
              Consumables:{" "}
              {Object.values(BOOST_CATALOG)
                .map((b) => `${b.label} — 2× ${b.label.startsWith("XP") ? "XP" : "earnings"} for ${b.hours}h (${b.cost.toLocaleString()} ★)`)
                .join("; ")}
              . Stacks up to 7 days; the countdown shows in your Lab.
            </p>
          </HoloCard>

          <HoloCard>
            <span className="uf-eyebrow">Step 05</span>
            <h2 className="text-xl font-semibold mt-1">The weekly rotation</h2>
            <p className="text-uf-muted text-sm mt-2">
              One frame and one title are spotlighted every ISO week (Monday to
              Sunday, UTC) — the same shelf for the whole fleet, marked with a{" "}
              <Sparkles className="inline h-3.5 w-3.5 -mt-0.5" aria-hidden /> in
              the Lab. Rotated items always return; nothing is permanently
              retired, and seasonal editions arrive with events.
            </p>
          </HoloCard>

          <HoloCard>
            <span className="uf-eyebrow">Step 06</span>
            <h2 className="text-xl font-semibold mt-1">Contribute & belong</h2>
            <p className="text-uf-muted text-sm mt-2">
              Submit stories to the approval queue, log lore for the archive,
              certify discoveries on the sector map, and fly with a group.
              Contributions earn credits and badges — and the best work gets
              featured on the front page. When you're ready, caches of Star
              Credits can also be requisitioned directly from the Depot, but
              everything cosmetic is earnable by play alone.
            </p>
            <div className="mt-4">
              <a
                href="/downloads/starforce-growth-plan.pdf"
                download
                className="inline-flex items-center gap-2 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] px-4 py-2 text-sm text-uf-text transition-colors hover:bg-[rgba(0,229,255,0.08)]"
              >
                <Download className="h-4 w-4" aria-hidden />
                Download the six-month fleet plan (PDF)
              </a>
            </div>
          </HoloCard>
        </div>

        {/* Six-month plan timeline (echoes the downloadable PDF) */}
        <h2 className="text-2xl font-semibold mt-12 mb-6">
          The road ahead — six-month fleet plan
        </h2>
        <div className="uf-grid uf-grid--2">
          {PHASES.map((p) => (
            <HoloCard key={p.phase}>
              <div className="flex items-center justify-between gap-3">
                <span className="uf-eyebrow">{p.phase}</span>
                <span className="text-xs font-mono text-[var(--uf-cyan)]">{p.window}</span>
              </div>
              <h3 className="text-lg font-semibold mt-1">{p.title}</h3>
              <ul className="list-none p-0 m-0 mt-3 space-y-1.5 text-sm text-uf-muted">
                {p.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span style={{ color: "var(--uf-cyan)" }} aria-hidden>▸</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </HoloCard>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
