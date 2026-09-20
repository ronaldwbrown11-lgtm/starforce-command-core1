import { OperatorShell } from "@/components/operator/OperatorShell";
import { HoloCard, StatusPill } from "@/components/uf";
import {
  Compass,
  Download,
  FileDown,
  GaugeCircle,
  ShoppingBag,
  Sparkles,
  Users,
  CalendarPlus,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

/**
 * The Road Ahead — operator-only command briefing.
 *
 * Single source of truth for the six-month Star Credits & Requisition Depot
 * growth plan. The PDF in /downloads/starforce-growth-plan.pdf is generated
 * from the same content; keep both in sync when the plan changes.
 * Route: /operator/road-ahead (capability-gated via OperatorGuard).
 */

type ItemStatus = "shipped" | "next" | "ops";

interface PlanItem {
  status: ItemStatus;
  text: string;
}

interface PlanPhase {
  phase: number;
  months: string;
  title: string;
  summary: string;
  items: PlanItem[];
}

const PHASES: PlanPhase[] = [
  {
    phase: 1,
    months: "Months 1–2",
    title: "Make the economy real",
    summary:
      "Credits become spendable identity: the Cosmetic Lab opens, the weekly rotation starts, and the first purchased credit caches land in the Requisition Depot.",
    items: [
      {
        status: "shipped",
        text: "Cosmetic Lab expansion — three departments: Frames (250–500 credits), Titles (300–900, incl. two command-award-only mission lines), Boosts (XP Surge 500, Credit Surge 750).",
      },
      {
        status: "shipped",
        text: "Star Credit caches in the Requisition Depot (kind: credits) — operators publish caches from the console; Stripe checkout and webhook fulfillment grant exact face value, audit-logged. Suggested: 500 @ $4.99, 1,200 @ $9.99, 2,600 @ $19.99.",
      },
      {
        status: "next",
        text: "Aspirational deep-sink item at 5,000+ credits so veterans always have a goal.",
      },
      {
        status: "ops",
        text: "Configure cache prices and seasonal cosmetics in the operator Store manager.",
      },
    ],
  },
  {
    phase: 2,
    months: "Months 2–3",
    title: "Social spending",
    summary:
      "Members spend credits on each other, not just on themselves — tipping, gifting, and group treasuries create the first creator economy on the base.",
    items: [
      {
        status: "next",
        text: "Credit gifting and tipping on stories and lore — authors earn from fans.",
      },
      { status: "next", text: "Profile display cases: show off owned cosmetics and trophies." },
      {
        status: "next",
        text: "Group treasuries: pooled credits unlock group banners, titles, and perks.",
      },
      { status: "ops", text: "Feature tipped authors on the front page weekly." },
    ],
  },
  {
    phase: 3,
    months: "Months 3–4",
    title: "Recurring events drive demand",
    summary:
      "Seasons, contests, and community goals give the rotation a heartbeat and give stockpiled credits something to chase.",
    items: [
      {
        status: "next",
        text: "Seasonal Cosmetic Pass: limited-edition frames and titles each season; numbered editions for prestige.",
      },
      {
        status: "next",
        text: "Weekly contest entry fees (credits) with merch prize pools from the depot.",
      },
      {
        status: "next",
        text: "Base-wide community goals: pooled credit contributions unlock canon content — a new lore chapter, a sector reveal.",
      },
      { status: "ops", text: "Schedule contests and events from the operator console." },
    ],
  },
  {
    phase: 4,
    months: "Months 4–5",
    title: "Premium & creators",
    summary:
      "Credits become the bridge between free and paid membership, and creators start earning on the base itself.",
    items: [
      {
        status: "next",
        text: "Lore rentals: 48-hour access to tier-gated archive content.",
      },
      {
        status: "next",
        text: "Creator program: members sell custom lore bibles and art through the depot; the base takes a revenue share.",
      },
      { status: "next", text: "ARG campaigns with credit bounties on solved ciphers." },
      { status: "ops", text: "Vet creator applications; approve listings before they go live." },
    ],
  },
  {
    phase: 5,
    months: "Month 6",
    title: "Polish & scale",
    summary:
      "Instrument the economy, reward loyalty, and make growth self-sustaining before the next planning cycle.",
    items: [
      {
        status: "next",
        text: "Credit economy dashboard in the operator console: earn/spend charts, inflation monitoring, faucet-vs-sink balance.",
      },
      {
        status: "next",
        text: "Achievement-linked cosmetics: milestone frames earned, not bought.",
      },
      {
        status: "next",
        text: "Referral rewards: credits for recruiting members who stay active.",
      },
    ],
  },
];

const STATUS_META: Record<
  ItemStatus,
  { label: string; variant: "success" | "warning" | "default" }
> = {
  shipped: { label: "Shipped", variant: "success" },
  next: { label: "Next", variant: "warning" },
  ops: { label: "Ops", variant: "default" },
};

const STANDING_RULES = [
  "Credits buy cosmetics, boosts, and access — never moderation influence, story approval, or rank.",
  "Every grant and spend is audit-logged.",
  "Purchased caches grant exactly their face value — no surge.",
  "Rotation items always return; nothing is permanently retired.",
];

const OPS_TOOLS = [
  { label: "Requisition Depot", href: "/operator/store", icon: ShoppingBag },
  { label: "Lore Contests", href: "/operator/contests", icon: Sparkles },
  { label: "Events Calendar", href: "/operator/events", icon: CalendarPlus },
  { label: "Users & Credits", href: "/operator/users", icon: Users },
  { label: "Analytics", href: "/operator/analytics", icon: GaugeCircle },
  { label: "Audit Trail", href: "/operator/audit", icon: ShieldCheck },
];

export default function OperatorRoadAhead() {
  return (
    <OperatorShell>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="uf-eyebrow">Operator Console · Command Briefing</span>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-semibold">
            <Compass className="h-7 w-7 text-[var(--uf-cyan)]" aria-hidden />
            The Road Ahead
          </h1>
          <p className="mt-1 text-sm text-uf-muted">
            The six-month growth plan for Star Credits and the Requisition
            Depot. Restricted to base command — this page is not linked from
            the public site.
          </p>
        </div>
        <a
          href="/downloads/starforce-growth-plan.pdf"
          download="Star-Force-1198-Six-Month-Growth-Plan.pdf"
          className="uf-btn uf-btn--primary shrink-0 cursor-pointer"
          aria-label="Download the six-month growth plan PDF"
        >
          <Download className="mr-1 h-4 w-4" aria-hidden />
          Download PDF
        </a>
      </header>

      <HoloCard className="mb-6">
        <div className="flex items-start gap-3">
          <TrendingUp className="mt-1 h-5 w-5 shrink-0 text-[var(--uf-cyan)]" aria-hidden />
          <div>
            <h2 className="text-base font-semibold">Command intent</h2>
            <p className="mt-1 text-sm leading-6 text-uf-muted">
              Grow Star Credits into the economic engine of the base: every
              member earns through contribution, spends on identity, and
              returns weekly for the rotation. Real money buys credit caches;
              credits never buy power.
            </p>
          </div>
        </div>
      </HoloCard>

      <section aria-label="Plan status legend" className="mb-6 flex flex-wrap items-center gap-3">
        <span className="uf-eyebrow">Status legend</span>
        {(Object.keys(STATUS_META) as ItemStatus[]).map((key) => (
          <StatusPill key={key} variant={STATUS_META[key].variant}>
            {STATUS_META[key].label}
            {key === "ops" ? " · no code required" : ""}
          </StatusPill>
        ))}
      </section>

      <ol className="mb-8 flex list-none flex-col gap-4 p-0 m-0">
        {PHASES.map((phase) => (
          <li key={phase.phase}>
            <HoloCard>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  <span className="font-mono text-[var(--uf-cyan)]">
                    Phase {phase.phase}
                  </span>{" "}
                  — {phase.title}
                </h2>
                <span className="text-xs uppercase tracking-[0.16em] text-uf-muted">
                  {phase.months}
                </span>
              </div>
              <p className="mt-1 text-sm leading-6 text-uf-muted">{phase.summary}</p>
              <ul className="mt-3 flex list-none flex-col gap-2 p-0 m-0">
                {phase.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-start gap-2 border border-[color:var(--uf-border)] rounded-md bg-[rgba(5,8,22,0.4)] px-3 py-2"
                  >
                    <StatusPill variant={STATUS_META[item.status].variant}>
                      {STATUS_META[item.status].label}
                    </StatusPill>
                    <span className="min-w-0 flex-1 text-sm leading-6">{item.text}</span>
                  </li>
                ))}
              </ul>
            </HoloCard>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <HoloCard>
          <h2 className="text-base font-semibold">Economy hygiene — standing policy</h2>
          <ul className="mt-3 flex list-none flex-col gap-2 p-0 m-0">
            {STANDING_RULES.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-6">
                <span className="mt-0.5 font-mono text-xs text-[var(--uf-cyan)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </HoloCard>

        <HoloCard>
          <h2 className="text-base font-semibold">Console shortcuts</h2>
          <p className="mt-1 text-sm text-uf-muted">
            Every [Ops] item above is run from one of these desks.
          </p>
          <ul className="mt-3 grid list-none grid-cols-2 gap-2 p-0 m-0 sm:grid-cols-3">
            {OPS_TOOLS.map(({ label, href, icon: Icon }) => (
              <li key={href}>
                <a
                  href={href}
                  className="uf-btn uf-btn--ghost h-full w-full justify-start text-xs"
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </HoloCard>
      </div>

      <p className="mt-6 flex items-center gap-2 text-xs text-uf-muted">
        <FileDown className="h-3.5 w-3.5" aria-hidden />
        This page and <code className="font-mono">/downloads/starforce-growth-plan.pdf</code>{" "}
        are generated from the same plan — update both together.
      </p>
    </OperatorShell>
  );
}
