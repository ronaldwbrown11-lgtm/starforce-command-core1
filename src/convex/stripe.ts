"use node";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
// Canonical pricing lives in the V8 module (stripeCatalog.ts) so the DB-side
// catalog functions and this Node action module can never drift apart.
import { TIER_PRICING } from "./stripeCatalog";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import Stripe from "stripe";

/**
 * Self-serve membership payments via Stripe hosted checkout.
 *
 * Required env vars (paste into the project's Keys/API keys tab):
 *   STRIPE_SECRET_KEY      — server-side API key (sk_...)
 *   STRIPE_WEBHOOK_SECRET  — signing secret for the /stripe-webhook route
 *
 * The publishable key is not needed at runtime: the client only redirects to
 * the hosted checkout URL, so no card data ever touches this app.
 *
 * Price tiers are created inline on each checkout (recurring monthly) by
 * default, so the Stripe dashboard needs no manual setup. Optionally,
 * operators can run the catalog sync (Operator Console → Billing):
 * syncStripeCatalog creates one canonical Product + monthly Price per tier
 * directly in Stripe, stores the Price IDs in the stripeCatalog table, and
 * checkout then references those Price IDs instead. The user is tagged via
 * session metadata and fulfilled by the webhook either way.
 */

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to your environment.");
  }
  return new Stripe(key);
}

// ---------------------------------------------------------------------------
// Product catalog sync (Operator Console → Billing) — DB helpers live in
// stripeCatalog.ts; this Node module drives the Stripe API side.
// ---------------------------------------------------------------------------

/**
 * Create (or adopt) the canonical Stripe Product + monthly Price for every
 * tier in TIER_PRICING and store the mappings. Idempotent and safe to
 * re-run: products are matched by tier metadata (falling back to the exact
 * product name, so products auto-created by earlier checkouts are adopted
 * rather than duplicated), and prices are matched by amount + interval.
 */
export const syncStripeCatalog = action({
  args: {},
  handler: async (ctx) => {
    const me = await getAuthUserId(ctx);
    if (me === null) throw new Error("Sign in required.");
    const user = await ctx.runQuery(api.users.currentUser);
    if (!user) throw new Error("User not found.");
    if (user.role !== "admin" && user.opRole !== "operator" && user.opRole !== "senior_operator") {
      throw new Error("Forbidden.");
    }

    const stripe = getStripe();
    const products = await stripe.products.list({ limit: 100 });
    let created = 0;
    const results: Array<{
      tier: string;
      name: string;
      productId: string;
      priceId: string;
      productAction: "created" | "adopted";
      priceAction: "created" | "reused";
    }> = [];

    for (const [tier, pricing] of Object.entries(TIER_PRICING)) {
      // 1. Find or create the canonical product for this tier.
      let product =
        products.data.find((p) => p.metadata?.tier === tier) ??
        products.data.find(
          (p) => p.name === pricing.name && p.active && !p.metadata?.tier,
        );
      let productAction: "created" | "adopted" = "adopted";
      if (!product) {
        product = await stripe.products.create({
          name: pricing.name,
          description: `${pricing.name} membership — Star Force Base 1198`,
          tax_code: "txcd_10000000",
          metadata: { tier },
        });
        productAction = "created";
      } else if (product.metadata?.tier !== tier) {
        // Adopt an inline-checkout product: tag it so future syncs match fast.
        await stripe.products.update(product.id, { metadata: { tier } });
      }

      // 2. Find or create the active monthly price at the tier's amount.
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
        limit: 100,
      });
      let price = prices.data.find(
        (p) =>
          p.type === "recurring" &&
          p.recurring?.interval === "month" &&
          p.unit_amount === pricing.unitAmount,
      );
      let priceAction: "created" | "reused" = "reused";
      if (!price) {
        price = await stripe.prices.create({
          product: product.id,
          currency: "usd",
          unit_amount: pricing.unitAmount,
          recurring: { interval: "month" },
        });
        priceAction = "created";
      }

      await ctx.runMutation(internal.stripeCatalog.saveCatalogEntry, {
        tier,
        productId: product.id,
        priceId: price.id,
        unitAmount: pricing.unitAmount,
        currency: "usd",
        interval: "month",
      });
      if (productAction === "created" || priceAction === "created") created++;
      results.push({
        tier,
        name: pricing.name,
        productId: product.id,
        priceId: price.id,
        productAction,
        priceAction,
      });
    }

    await ctx.runMutation(internal.stripeCatalog.auditCatalogSync, {
      actorId: me,
      synced: results.length,
      created,
    });
    return { ok: true as const, results };
  },
});

/**
 * Called by the /stripe-webhook route (which runs in the edge runtime).
 * Verifies the Stripe signature here in Node, then fulfils the event:
 *  - checkout.session.completed        → grant the purchased tier
 *  - customer.subscription.deleted     → revert to Free (cancellation / failed renewal)
 */
export const processWebhook = action({
  args: {
    body: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return {
        ok: false,
        status: 500,
        message: "STRIPE_WEBHOOK_SECRET is not configured.",
      };
    }

    let stripe: Stripe;
    try {
      stripe = getStripe();
    } catch (e) {
      return {
        ok: false,
        status: 500,
        message: e instanceof Error ? e.message : "Stripe is not configured.",
      };
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(args.body, args.signature, secret);
    } catch (e) {
      return {
        ok: false,
        status: 400,
        message: `Webhook signature verification failed: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode !== "subscription") break;
          const userId = session.metadata?.userId;
          const tier = session.metadata?.tier;
          if (!userId || !tier) break;
          const res = await ctx.runMutation(api.users.fulfillTier, {
            userId: userId as Id<"users">,
            tier,
            customerId: typeof session.customer === "string" ? session.customer : undefined,
            subscriptionId:
              typeof session.subscription === "string" ? session.subscription : undefined,
          });
          // If the user had an older subscription, cancel it so they aren't
          // double-billed (its later `deleted` event is a no-op thanks to the
          // stale-subscription guard in revertStripeSubscription).
          if (res.supersededSubscriptionId) {
            try {
              await stripe.subscriptions.cancel(res.supersededSubscriptionId);
            } catch {
              // Non-fatal — fulfillment already landed.
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          const userId = subscription.metadata?.userId;
          if (!userId) break;
          await ctx.runMutation(api.users.revertStripeSubscription, {
            userId: userId as Id<"users">,
            subscriptionId: subscription.id,
          });
          break;
        }

        default:
          break;
      }
    } catch (e) {
      return {
        ok: false,
        status: 500,
        message: `Webhook handling failed: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }

    return { ok: true };
  },
});

/**
 * Start a hosted Stripe checkout for a paid tier. The user is redirected to
 * the returned URL; on successful payment the /stripe-webhook route fulfills
 * the tier (api.users.fulfillTier).
 */
export const createCheckoutSession = action({
  args: {
    tier: v.string(),
    origin: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    const pricing = TIER_PRICING[args.tier];
    if (!pricing) {
      throw new Error("Free tier has no checkout — use cancelMySubscription to downgrade.");
    }
    if (!/^https?:\/\//.test(args.origin)) {
      throw new Error("Invalid origin.");
    }

    const user = await ctx.runQuery(api.users.currentUser);
    if (!user) {
      throw new Error("User not found.");
    }

    const stripe = getStripe();

    // Reuse the Stripe customer when one already exists.
    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.displayName ?? user.name ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await ctx.runMutation(api.users.saveStripeCustomer, { customerId });
    }

    // Prefer the synced catalog Price ID (Operator Console → Billing sync);
    // fall back to inline price_data for tiers that were never synced.
    const catalog = await ctx.runQuery(internal.stripeCatalog.getCatalogEntry, {
      tier: args.tier,
    });
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = catalog
      ? { quantity: 1, price: catalog.priceId }
      : {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pricing.unitAmount,
            recurring: { interval: "month" },
            product_data: {
              name: pricing.name,
              description: `${pricing.name} membership — Star Force Base 1198`,
              // Required when Stripe Managed Payments is enabled on the account.
              // txcd_10000000 = general digital services (electronically supplied).
              tax_code: "txcd_10000000",
            },
          },
        };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [lineItem],
      subscription_data: {
        metadata: { userId, tier: args.tier },
      },
      // Tag the checkout so the webhook knows who to fulfill.
      metadata: { userId, tier: args.tier },
      success_url: `${args.origin}/membership?checkout=success`,
      cancel_url: `${args.origin}/membership?checkout=cancelled`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }
    return { url: session.url };
  },
});

/**
 * Open the Stripe customer billing portal — manage subscription, update
 * payment method, view invoices. Returns the hosted portal URL; the user
 * is redirected there and back to `origin` on return.
 */
export const openBillingPortal = action({
  args: {
    origin: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    if (!/^https?:\/\//.test(args.origin)) {
      throw new Error("Invalid origin.");
    }
    const user = await ctx.runQuery(api.users.currentUser);
    if (!user) {
      throw new Error("User not found.");
    }
    if (!user.stripeCustomerId) {
      throw new Error(
        "No subscription on file yet — choose a paid tier to get started.",
      );
    }
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${args.origin}/membership`,
    });
    return { url: session.url };
  },
});

/**
 * Cancel the current user's Stripe subscription (if any) and immediately
 * downgrade to the Free tier. Called from the Membership page's Downgrade
 * button; the webhook's revertStripeSubscription covers cancellations made
 * directly in the Stripe billing portal.
 */
export const cancelMySubscription = action({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Sign in required.");
    }
    const user = await ctx.runQuery(api.users.currentUser);
    if (!user) {
      throw new Error("User not found.");
    }

    if (user.stripeSubscriptionId) {
      const stripe = getStripe();
      try {
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
      } catch (e) {
        // Billing cancel failed (e.g. already cancelled) — the tier switch
        // below still applies; the webhook only reverts on a matching id.
        console.error("Stripe subscription cancel failed:", e);
      }
    }

    if ((user.tier ?? "free") !== "free") {
      await ctx.runMutation(api.users.changeMyTier, { tier: "free" });
    }
    return { ok: true };
  },
});
