import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

// Lab images — stable public URLs pinned into species/technology rows by
// the lab upload widget (labs:generateImageUploadUrl → finalizeImageUpload).
// Convex's own storage URLs expire within the hour, so rows store this
// permanent /lab-image/<storageId> path instead; it streams the file straight
// out of Convex storage with immutable caching.
http.route({
  pathPrefix: "/lab-image/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const id = new URL(request.url).pathname.split("/").pop() ?? "";
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
      return new Response("Not found", { status: 404 });
    }
    let blob: Blob | null = null;
    try {
      blob = await ctx.storage.get(id as Id<"_storage">);
    } catch {
      blob = null; // malformed or unknown storage id — treat as missing
    }
    if (!blob) return new Response("Not found", { status: 404 });
    return new Response(blob, {
      headers: {
        "Content-Type": blob.type || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
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
