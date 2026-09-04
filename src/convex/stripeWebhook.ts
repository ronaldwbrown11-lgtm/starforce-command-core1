import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Stripe webhook route (edge runtime) — forwards the raw body and signature
 * to the Node-runtime action `api.stripe.processWebhook`, which verifies the
 * signature with the Stripe SDK and fulfils membership grants.
 *
 * Register in the Stripe dashboard at:
 *   https://dashboard.stripe.com/webhooks  →  endpoint:
 *   https://<your-project>.convex.site/stripe-webhook  (events:
 *   checkout.session.completed, customer.subscription.deleted)
 *   (Convex HTTP routes live on the `.convex.site` domain, not the static site.)
 */
export const stripeWebhook = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const body = await request.text();
  const result = await ctx.runAction(api.stripe.processWebhook, { body, signature });
  if (!result.ok) {
    return new Response(result.message ?? "Webhook handling failed", {
      status: result.status ?? 500,
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
