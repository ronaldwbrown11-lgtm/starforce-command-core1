import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BookOpen, Sparkles } from "lucide-react";
import { SiteShell, PageHero, HoloCard } from "@/components/uf";
import { DocViewer } from "@/components/widgets/DocViewer";
import { usePageMeta } from "@/hooks/use-page-meta";
import {
  FRAME_CATALOG,
  TITLE_CATALOG,
  BOOST_CATALOG,
  CREDIT_RATES,
} from "@/lib/economy";

// ---------------------------------------------------------------------------
// New Cadets Manual — the standing orientation document.
//
// If High Command has uploaded an onboarding guide (Content Desk → Resources
// → type "onboarding" with a file), the page shows THAT guide front and
// center — clicking it opens the document right on the page (inline reader,
// no download). Without an uploaded guide, the page falls back to the
// six-step card layout. The six-month growth plan also opens on the page.
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

  // Uploaded onboarding guide (preferred) vs. fallback card layout.
  const guides = useQuery(api.content.listResources, {
    type: "onboarding",
    limit: 10,
  });
  const [reader, setReader] = useState<{ url: string; name: string } | null>(
    null,
  );
  const guideWithFile = (guides ?? []).find((g) => g.fileUrl);
  const guide = guideWithFile ?? (guides ?? []).find((g) => g.url);

  const openGuide = () => {
    if (!guide) return;
    if (guide.fileUrl) {
      setReader({
        url: guide.fileUrl,
        name: guide.fileMeta?.fileName ?? "Cadet guide",
      });
    } else if (guide.url) {
      window.open(guide.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <SiteShell>
      <PageHero
        eyebrow="Orientation"
        title="New Cadets Manual"
        lead="Everything a new recruit needs: how the base runs, how you earn your place, and how your legend is displayed. Read it once; refer to it always."
        primary={{ label: "Start Pilot Orientation", href: "/account", variant: "primary" }}
        secondary={{ label: "Back to base", href: "/", variant: "ghost" }}
      />

      {guides !== undefined && guide ? (
        /* ---------- Guide-first layout: the uploaded guide opens on-page ---------- */
        <section className="uf-section max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-12">
          <HoloCard
            className="!p-6 cursor-pointer"
            htmlProps={{
              role: "button",
              tabIndex: 0,
              "aria-label": "Open the cadet guide",
              onClick: openGuide,
              onKeyDown: (e: { key: string; preventDefault: () => void }) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openGuide();
                }
              },
            }}
          >
            <span className="uf-eyebrow">Cadet guide · uploaded by High Command</span>
            <h2 className="text-2xl md:text-3xl mt-2 flex items-center gap-3 flex-wrap">
              <BookOpen className="h-6 w-6 text-uf-cyan" aria-hidden />
              {guide.fileMeta?.fileName ?? guide.title}
            </h2>
            <p className="text-uf-muted text-sm mt-2 max-w-[60ch]">
              {guide.description ||
                "Click to read the guide right here on the page — it opens in an on-page reader, no download needed."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="uf-btn uf-btn--primary">
                <BookOpen className="h-4 w-4 mr-1.5" aria-hidden />
                Read the guide
              </span>
              {guide.fileUrl ? (
                <span className="text-uf-muted text-xs uppercase tracking-[0.14em]">
                  or use Download inside the reader
                </span>
              ) : (
                <span className="text-uf-muted text-xs uppercase tracking-[0.14em]">
                  opens in a new tab
                </span>
              )}
            </div>
          </HoloCard>
        </section>
      ) : guides === undefined ? (
        <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="uf-skeleton" style={{ height: 320 }} />
        </section>
      ) : (
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <div className="uf-grid uf-grid--2">
          <HoloCard>
            <span className="uf-eyebrow">Step 01</span>
            <h2 className="text-xl font-semibold mt-1">Arrive & identify</h2>
            <p className="text-uf-muted text-sm mt-2">
              Sign in with your email and complete Pilot Orientation: choose a
              callsign and a fleet affiliation, then assign your starship
              through the six-step wizard. You enter the fleet as a Tier 7
              Ensign — everything is editable later from your Account page,
              nothing you pick now is permanent.
            </p>
            <p className="text-uf-muted text-sm mt-2">
              When orientation finishes, the Cadet Induction quest lights up.
              It walks you through joining a group, reacting to a story, filing
              a report, and earning your first badge — paying out XP and Star
              Credits as you go. Finish the induction checklist at 100% on the
              High Command dashboard and you're promoted to Lieutenant, where
              XP tracking begins.
            </p>
          </HoloCard>

          <HoloCard>
            <span className="uf-eyebrow">Step 02</span>
            <h2 className="text-xl font-semibold mt-1">Climb the ranks</h2>
            <p className="text-uf-muted text-sm mt-2">
              XP comes from quests, missions, contests, Signal Vault ciphers,
              and community activity. Ranks climb automatically: Ensign
              (checklist) → Lieutenant at 1,500 XP → Lieutenant Commander at
              4,000 → Commander at 9,000 → Captain (Fleet) at 23,000 → Rear
              Admiral at 35,000, where ten active seats form the High Command.
              Paid tiers climb faster through their XP multipliers, but every
              rank is earnable on Free.
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
              <button
                type="button"
                onClick={() =>
                  setReader({
                    url: "/downloads/starforce-growth-plan.pdf",
                    name: "Six-month fleet plan (PDF)",
                  })
                }
                className="inline-flex items-center gap-2 rounded-md border border-[color:var(--uf-border)] bg-[rgba(16,24,39,0.5)] px-4 py-2 text-sm text-uf-text transition-colors hover:bg-[rgba(0,229,255,0.08)]"
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Open the six-month fleet plan (PDF)
              </button>
            </div>
          </HoloCard>
        </div>
      </section>
      )}

      {/* On-page document reader — guides open here, never auto-download */}
      <DocViewer
        url={reader?.url ?? null}
        fileName={reader?.name ?? null}
        onClose={() => setReader(null)}
      />
    </SiteShell>
  );
}
