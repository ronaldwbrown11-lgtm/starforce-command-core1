import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HoloCard, NeonButton } from "@/components/uf";
import { StatusPill } from "@/components/uf/StatusPill";
import { toast } from "sonner";
import { CreditCard, RefreshCw } from "lucide-react";

function usd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function shortId(id?: string) {
  if (!id) return "—";
  return id.length > 24 ? `${id.slice(0, 12)}…${id.slice(-8)}` : id;
}

export default function OperatorBilling() {
  const catalog = useQuery(api.stripeCatalog.getCatalog, {});
  const sync = useAction(api.stripe.syncStripeCatalog);
  const [syncing, setSyncing] = useState(false);

  const runSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await sync({});
      const createdCount = res.results.filter(
        (r) => r.productAction === "created" || r.priceAction === "created",
      ).length;
      toast.success(
        `Catalog synced — ${res.results.length} tiers mapped to Stripe` +
          (createdCount > 0 ? ` (${createdCount} new objects created).` : "."),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Catalog sync failed — check STRIPE_SECRET_KEY.",
      );
    } finally {
      setSyncing(false);
    }
  };

  const syncedCount = (catalog ?? []).filter((t) => t.synced).length;

  return (
    <div className="uf-section px-4 sm:px-6 lg:px-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="uf-eyebrow flex items-center gap-2">
            <CreditCard className="h-4 w-4" aria-hidden /> Billing
          </span>
          <h1 className="text-2xl md:text-3xl mt-2">Stripe product catalog</h1>
          <p className="text-uf-muted text-sm mt-2 max-w-[64ch]">
            One canonical Product + monthly Price per membership tier, created
            directly in Stripe. Checkout references these Price IDs, so the
            dashboard shows every tier — including ones that never had a
            checkout.
          </p>
        </div>
        <NeonButton
          variant="primary"
          loading={syncing}
          onClick={() => void runSync()}
        >
          <RefreshCw className="h-4 w-4 mr-1.5" aria-hidden />
          Sync catalog with Stripe
        </NeonButton>
      </div>

      <HoloCard className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-base font-semibold">Membership tiers</h2>
          <span className="text-uf-muted text-xs">
            {catalog === undefined
              ? "Loading…"
              : `${syncedCount} of ${catalog.length} tiers synced`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-uf-muted text-xs uppercase tracking-[0.14em]">
                <th className="py-2 pr-4 font-normal">Tier</th>
                <th className="py-2 pr-4 font-normal">Price</th>
                <th className="py-2 pr-4 font-normal">Status</th>
                <th className="py-2 pr-4 font-normal">Product</th>
                <th className="py-2 pr-4 font-normal">Price ID</th>
              </tr>
            </thead>
            <tbody>
              {(catalog ?? []).map((t) => (
                <tr key={t.tier} className="border-t border-[color:var(--uf-border)]">
                  <td className="py-2.5 pr-4">
                    <span className="font-medium">{t.name}</span>
                    <span className="block text-[11px] text-uf-muted">{t.tier}</span>
                  </td>
                  <td className="py-2.5 pr-4 whitespace-nowrap">
                    {usd(t.unitAmount)}
                    <span className="text-uf-muted">/mo</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    {t.synced ? (
                      <StatusPill variant="success">Synced</StatusPill>
                    ) : (
                      <StatusPill variant="warning">Not synced</StatusPill>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-uf-muted" title={t.productId}>
                    {shortId(t.productId)}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs text-uf-muted" title={t.priceId}>
                    {shortId(t.priceId)}
                  </td>
                </tr>
              ))}
              {catalog !== undefined && catalog.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-uf-muted text-sm">
                    No tiers configured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </HoloCard>

      <HoloCard className="mt-6">
        <h2 className="text-base font-semibold mb-3">How the sync works</h2>
        <ul className="text-sm text-uf-muted space-y-2 list-disc pl-5">
          <li>
            <span className="text-uf-text">Safe to re-run.</span> Existing
            products are matched by tier metadata (or exact name, adopting
            products auto-created by earlier checkouts) — nothing is
            duplicated.
          </li>
          <li>
            <span className="text-uf-text">Amount changes.</span> If a tier's
            price changes in code, the next sync creates a new Price on the
            same Product and checkout switches to it automatically.
          </li>
          <li>
            <span className="text-uf-text">Mode.</span> Objects are created in
            the mode of the configured{" "}
            <code className="font-mono text-xs">STRIPE_SECRET_KEY</code> —
            check the matching view (Test mode / Live) in the Stripe
            dashboard.
          </li>
          <li>
            <span className="text-uf-text">Cleanup.</span> Leftover duplicate
            products from old test checkouts can be archived by hand in
            Stripe → Product catalog; with no customers yet, nothing attached
            to them can break.
          </li>
        </ul>
      </HoloCard>
    </div>
  );
}
