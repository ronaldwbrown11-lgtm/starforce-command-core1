"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
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
 * Price tiers are created inline on each checkout (recurring monthly), so
 * no product/price setup in the Stripe dashboard is required. The user is
 * tagged via session metadata and fulfilled by the webhook.
 */

const TIER_PRICING: Record<string, { name: string; unitAmount: number }> = {
  cadet: { name: "Star Force Cadet", unitAmount: 500 },
  officer: { name: "Star Force Officer", unitAmount: 1200 },
  command: { name: "Star Force Command", unitAmount: 2500 },
  elite: { name: "Star Force Elite", unitAmount: 1900 },
  gia_agent: { name: "GIA Agent", unitAmount: 4900 },
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured. Add STRIPE_SECRET_KEY to your environment.");
  }
  return new Stripe(key);
}

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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
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
        },
      ],
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
