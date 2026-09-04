import { useState, useEffect, type ReactNode } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SiteShell, PageHero, NeonButton, HoloCard, StatusPill } from "@/components/uf";
import {
  TIER_ORDER,
  TIERS,
  tierFlagPill,
  tierPillVariant,
  type TierId,
} from "@/lib/tiers";
import { VOICE } from "@/lib/voice";
import { Link } from "react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { usePageMeta } from "@/hooks/use-page-meta";

const FAQ = [
  {
    q: "Can I cancel my membership?",
    a: "Yes. Open Membership and hit Downgrade to Free — your Stripe subscription is cancelled immediately and you drop back to the Free tier. Refunds within 14 days of first charge.",
  },
  {
    q: "How do I switch between tiers?",
    a: "Sign in, open Membership, and pick a tier. Paid upgrades open a secure Stripe checkout (any card) and apply the moment payment clears. Downgrades apply instantly and cancel any active subscription.",
  },
  {
    q: "What does Command get that Cadet doesn't?",
    a: "750 AI generations / month (vs 100), 40 GB storage (vs 5 GB), 200 MB max upload (vs 50 MB), and priority featured placement.",
  },
  {
    q: "What's the difference between Officer and Command?",
    a: "Officer is steady-state creator pace — 300 generations, 15 GB. Command is for series releases, team collaborations, frequent drops — 750 generations, 40 GB, priority placement.",
  },
  {
    q: "What does G.I.A Agent include?",
    a: "Top-tier access: 2,000 AI generations / month, 100 GB storage, 500 MB max upload, private groups, podcast publishing, and priority featured placement.",
  },
  {
    q: "Is my data safe?",
    a: "Two-factor authentication, row-level permission checks, audit log captures every operator action. No hardcoded secrets.",
  },
];

const FEATURE_ROWS: Array<{
  key: keyof (typeof TIERS)["free"]["benefits"] extends never
    ? string
    : "ai" | "storage" | "upload" | "groups" | "podcast" | "featured";
  label: string;
  render: (id: TierId) => ReactNode;
}> = [
  {
    key: "ai" as const,
    label: "AI generations / month",
    render: (id) => `${TIERS[id].aiGenerations.toLocaleString()}`,
  },
  {
    key: "storage" as const,
    label: "Storage",
    render: (id) => `${TIERS[id].storageGb} GB`,
  },
  {
    key: "upload" as const,
    label: "Max upload",
    render: (id) => `${TIERS[id].maxUploadMb} MB`,
  },
  {
    key: "groups" as const,
    label: "Private groups",
    render: () => <StatusPill variant="success">Included</StatusPill>,
  },
  {
    key: "podcast" as const,
    label: "Podcast publishing",
    render: () => <StatusPill variant="success">Included</StatusPill>,
  },
  {
    key: "featured" as const,
    label: "Featured placement",
    render: (id) => {
      const flag = TIERS[id].flag;
      if (flag === "top") {
        return (
          <StatusPill variant="gold">Top placement</StatusPill>
        );
      }
      if (flag === "priority") {
        return (
          <StatusPill variant="violet">Priority</StatusPill>
        );
      }
      return <StatusPill variant="info">Standard</StatusPill>;
    },
  },
];

const TIER_RANK: Record<TierId, number> = {
  free: 0,
  cadet: 1,
  officer: 2,
  command: 3,
  elite: 4,
  gia_agent: 5,
};

function useTierSwitch() {
  const changeTier = useMutation(api.users.changeMyTier);
  const startCheckout = useAction(api.stripe.createCheckoutSession);
  const cancelSub = useAction(api.stripe.cancelMySubscription);
  const [pending, setPending] = useState<TierId | null>(null);

  async function switchTo(tier: TierId, label: string) {
    setPending(tier);
    try {
      if (tier === "free") {
        // Downgrade: cancel any Stripe subscription, then drop to Free.
        await cancelSub();
        toast.success(`Now on the ${label} tier — subscription cancelled.`);
      } else {
        try {
          const { url } = await startCheckout({
            tier,
            origin: window.location.origin,
          });
          window.location.href = url;
          return;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (!msg.includes("not configured")) {
            throw e;
          }
          // Stripe keys absent (demo mode) — apply the switch instantly.
          await changeTier({ tier });
          toast.info(`Now on the ${label} tier (demo mode — no card charged).`);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Tier change failed.");
    } finally {
      setPending(null);
    }
  }

  return { pending, switchTo };
}

export default function Membership() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { pending, switchTo } = useTierSwitch();
  const openPortal = useAction(api.stripe.openBillingPortal);
  const [portalBusy, setPortalBusy] = useState(false);
  const currentTier: TierId = (user?.tier ?? "free") as TierId;

  usePageMeta({
    title: "Membership — Star Force Base 1198",
    description: "Upgrade your clearance. Cadet, Officer, Command, and GIA Agent tiers with AI generations, storage, and priority placement.",
    jsonLd: {
      "@type": "Product",
      name: "Star Force Membership",
      description: "Tiered membership for the Star Force 1198 community",
      offers: TIER_ORDER.map((id) => ({
        "@type": "Offer",
        name: TIERS[id].name,
        price: TIERS[id].cycles ? TIERS[id].priceLabel?.replace(/[^0-9.]/g, "") : "0",
        priceCurrency: "USD",
      })),
    },
  });
  const currentRank = TIER_RANK[currentTier];

  async function handlePortal() {
    setPortalBusy(true);
    try {
      const { url } = await openPortal({ origin: window.location.origin });
      window.location.href = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("not configured")) {
        toast.info("Stripe isn't configured yet — manage tiers directly on this page.");
      } else {
        toast.error(msg || "Couldn't open the billing portal.");
      }
    } finally {
      setPortalBusy(false);
    }
  }

  // Confirmation toast when Stripe redirects back after a successful payment.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      toast.success("Payment received — your tier is now active.");
      // Clean the query string so the toast doesn't re-fire on refresh.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <SiteShell>
      <PageHero
        eyebrow={VOICE.memberEyebrow}
        title={VOICE.heroTitle}
        lead={VOICE.heroLead}
        primary={{ label: "See tiers", href: "#tiers", variant: "primary" }}
        secondary={{ label: "Compare matrix", href: "#matrix", variant: "ghost" }}
      />
      <section
        id="tiers"
        className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12"
      >
        <div className="uf-grid uf-grid--3">
          {TIER_ORDER.map((id) => {
            const tier = TIERS[id];
            const variant = tierPillVariant(id);
            const flagInfo = tierFlagPill(tier.flag);
            const buttonVariant =
              tier.variant === "gold"
                ? ("gold" as const)
                : tier.variant === "violet"
                  ? ("violet" as const)
                  : tier.variant === "cyan"
                    ? ("primary" as const)
                    : ("primary" as const);
            const highlighted = tier.flag === "priority";
            return (
              <HoloCard
                key={tier.id}
                className={
                  highlighted
                    ? "!shadow-[var(--uf-glow-violet)]"
                    : ""
                }
                as="article"
              >
                <header className="flex items-start justify-between mb-2 gap-2">
                  <div>
                    <span className="uf-eyebrow">Tier</span>
                    <h3 className="text-2xl font-semibold mt-1">{tier.name}</h3>
                  </div>
                  <StatusPill variant={variant}>
                    {flagInfo.label}
                  </StatusPill>
                </header>
                <p className="text-uf-muted text-sm mt-2">{tier.blurb}</p>
                <p className="text-uf-text font-semibold mt-4 text-lg">
                  {tier.priceLabel ?? "Free"}
                  {tier.cycles ? (
                    <span className="text-uf-muted text-sm font-normal">
                      {tier.cycles}
                    </span>
                  ) : null}
                </p>
                <ul className="text-sm mt-4 space-y-2">
                  {tier.benefits.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--uf-cyan)" }}
                      />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                {isLoading ? (
                  <NeonButton variant="ghost" className="w-full" disabled>
                    Loading…
                  </NeonButton>
                ) : tier.id === currentTier ? (
                  <NeonButton
                    variant={buttonVariant}
                    className="w-full"
                    disabled
                    aria-label={`You are on the ${tier.name} tier`}
                  >
                    Current tier
                  </NeonButton>
                ) : !isAuthenticated ? (
                  <Link
                    to={`/auth?returnTo=/membership`}
                    className="block mt-6"
                  >
                    <NeonButton variant={buttonVariant} className="w-full">
                      {tier.id === "free"
                        ? "Continue Mission"
                        : `Promote to ${tier.name}`}
                    </NeonButton>
                  </Link>
                ) : (
                  <NeonButton
                    variant={buttonVariant}
                    className="w-full"
                    disabled={pending === tier.id}
                    aria-busy={pending === tier.id}
                    onClick={() => switchTo(tier.id, tier.name)}
                  >
                    {pending === tier.id
                      ? tier.id === "free"
                        ? "Cancelling…"
                        : "Opening checkout…"
                      : TIER_RANK[tier.id] < currentRank
                        ? `Downgrade to ${tier.name}`
                        : `Upgrade to ${tier.name}`}
                  </NeonButton>
                )}
              </HoloCard>
            );
          })}
        </div>
      </section>
      <section
        id="matrix"
        tabIndex={-1}
        className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12 scroll-mt-24"
      >
        <header className="mb-6">
          <span className="uf-eyebrow">Benefits matrix</span>
          <h2 className="text-3xl font-semibold mt-2">Compare every tier side-by-side.</h2>
        </header>
        <HoloCard className="!p-0 overflow-x-auto">
          <table className="uf-data-grid" style={{ minWidth: 760 }}>
            <caption className="uf-sr-only">
              Feature comparison across all 6 membership tiers
            </caption>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                {TIER_ORDER.map((id) => (
                  <th key={id} scope="col">
                    <StatusPill variant={tierPillVariant(id)}>{TIERS[id].name}</StatusPill>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  {TIER_ORDER.map((id) => (
                    <td key={id}>{row.render(id)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">Price</th>
                {TIER_ORDER.map((id) => (
                  <td key={id}>
                    <strong>{TIERS[id].priceLabel ?? "Free"}</strong>
                    {TIERS[id].cycles ? (
                      <span className="text-uf-muted text-xs">{TIERS[id].cycles}</span>
                    ) : null}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </HoloCard>
      </section>
      <section className="uf-section max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-12">
        <h2 className="text-2xl font-semibold mb-6">Frequently asked</h2>
        <div className="uf-grid uf-grid--2">
          {FAQ.map((f) => (              <HoloCard key={f.q}>
                <h3 className="text-lg font-semibold">{f.q}</h3>
                <p className="text-uf-muted text-sm mt-2">{f.a}</p>
              </HoloCard>
            ))}
        </div>
        {isAuthenticated && (
          <HoloCard className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">
                  Current clearance:{" "}
                  <span className="text-uf-cyan">{TIERS[currentTier].name}</span>
                </h3>
                <p className="text-uf-muted text-sm mt-1">
                  Changes apply instantly. Downgrading re-balances your limits
                  to the new tier immediately.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {currentTier !== "free" ? (
                  <NeonButton
                    variant="ghost"
                    loading={portalBusy}
                    onClick={handlePortal}
                  >
                    Manage subscription
                  </NeonButton>
                ) : null}
                <Link to="/account">
                  <NeonButton variant="ghost">Usage & limits</NeonButton>
                </Link>
              </div>
            </div>
          </HoloCard>
        )}
      </section>
    </SiteShell>
  );
}
