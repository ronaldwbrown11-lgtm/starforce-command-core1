import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { stripeWebhook } from "./stripeWebhook";
import { generateSitemap } from "./sitemap";

const http = httpRouter();

auth.addHttpRoutes(http);

// Stripe membership fulfillment — see https://dashboard.stripe.com/webhooks
http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: stripeWebhook,
});

// Live sitemap.xml — generated from database content
http.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: generateSitemap,
});

http.route({
  path: "/robots.txt",
  method: "GET",
  handler: httpAction(async () =>
    new Response(
      "User-agent: *\nAllow: /\nDisallow: /operator\nDisallow: /account\nDisallow: /messages\nSitemap: https://starforcebase1198.com/sitemap.xml\n",
      { headers: { "Content-Type": "text/plain; charset=utf-8" } },
    )),
});

export default http;
