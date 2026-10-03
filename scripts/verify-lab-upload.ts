// ===========================================================================
// Headless end-to-end check of the lab upload widget's exact call sequence.
//
// The React widget (src/components/labs/ImageUploadField.tsx) performs these
// same steps in the browser; this script runs them from the terminal with an
// anonymous session (the existing `anonymous` provider in src/convex/auth.ts)
// so the flow is verified without needing a browser:
//
//   1. unauthenticated calls must be refused
//   2. sign in (anonymous) → mint upload URL → POST file → finalize → URL
//   3. GET the returned /lab-image/ URL (200, image/png, immutable cache)
//   4. non-image uploads are rejected server-side and deleted
//   5. discardImage removes an unreferenced upload → URL then 404s
//
// Usage: bun scripts/verify-lab-upload.ts
// ===========================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";

const CONVEX_URL =
  process.env.CONVEX_URL ?? "https://lovely-koala-228.convex.cloud";

// 1×1 transparent PNG — a valid image/png payload.
const PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function expectThrow(fn: () => Promise<unknown>, label: string) {
  try {
    await fn();
  } catch (e) {
    console.log(`  ✓ ${label} refused: ${String((e as Error).message).slice(0, 90)}`);
    return;
  }
  throw new Error(`ASSERTION FAILED: ${label} should have thrown`);
}

async function main() {
  console.log("Lab upload widget — headless E2E against", CONVEX_URL);

  // 1. Unauthenticated calls must be refused.
  const stranger = new ConvexHttpClient(CONVEX_URL);
  await expectThrow(
    () => stranger.mutation(api.labs.generateImageUploadUrl, {}),
    "unauthenticated generateImageUploadUrl",
  );

  // 2. Anonymous session (same provider the site already ships).
  const client = new ConvexHttpClient(CONVEX_URL);
  const auth = await client.action(api.auth.signIn, {
    provider: "anonymous",
    params: {},
  });
  const token = "tokens" in auth ? auth.tokens?.token : undefined;
  assert(token, "anonymous sign-in returned no tokens");
  client.setAuth(token!);
  console.log("  ✓ anonymous session established");

  // 3. The widget's exact sequence.
  const uploadUrl = await client.mutation(api.labs.generateImageUploadUrl, {});
  assert(/^https?:\/\//.test(uploadUrl), "upload URL shape");
  console.log("  ✓ upload URL minted");

  const post = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: PNG_BYTES,
  });
  assert(post.ok, `storage POST failed: ${post.status}`);
  const { storageId } = (await post.json()) as { storageId: string };
  assert(storageId, "no storageId in upload response");
  console.log("  ✓ file stored:", storageId);

  const fin = await client.mutation(api.labs.finalizeImageUpload, {
    storageId: storageId as Id<"_storage">,
  });
  if (fin.ok !== true) {
    throw new Error(`ASSERTION FAILED: finalize rejected: ${fin.error}`);
  }
  assert(
    /^https?:\/\/.+\/lab-image\/[a-zA-Z0-9_-]+$/.test(fin.url),
    `finalize URL shape: ${fin.url}`,
  );
  assert(fin.contentType === "image/png", `contentType: ${fin.contentType}`);
  console.log("  ✓ finalized:", fin.url);

  // 4. Serve check — the URL the form stores must actually render forever.
  const get = await fetch(fin.url);
  assert(get.status === 200, `expected 200, got ${get.status}`);
  assert(
    (get.headers.get("content-type") ?? "").includes("image/png"),
    `serve content-type: ${get.headers.get("content-type")}`,
  );
  assert(
    (get.headers.get("cache-control") ?? "").includes("immutable"),
    `serve cache-control: ${get.headers.get("cache-control")}`,
  );
  console.log("  ✓ GET 200 image/png with immutable cache");

  // 5. Non-image uploads are rejected server-side (and the blob deleted).
  const badUrl = await client.mutation(api.labs.generateImageUploadUrl, {});
  const badPost = await fetch(badUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "definitely not an image",
  });
  const bad = (await badPost.json()) as { storageId: string };
  const badFin = await client.mutation(api.labs.finalizeImageUpload, {
    storageId: bad.storageId as Id<"_storage">,
  });
  if (badFin.ok !== false) {
    throw new Error("ASSERTION FAILED: non-image finalize was accepted");
  }
  if (!badFin.error.includes("Images only")) {
    throw new Error(`ASSERTION FAILED: MIME rejection message: ${badFin.error}`);
  }
  let badRetry = "";
  try {
    await client.mutation(api.labs.finalizeImageUpload, {
      storageId: bad.storageId as Id<"_storage">,
    });
  } catch (e) {
    badRetry = String((e as Error).message);
  }
  assert(
    badRetry.includes("Uploaded file not found"),
    `rejected non-image blob was not deleted: ${badRetry}`,
  );
  console.log("  ✓ non-image rejected and blob cleaned up");

  // 5b. Membership tier gate — free tier caps files at 5 MB; the rejected
  // blob is deleted server-side (re-finalize must report it missing).
  const bigUrl = await client.mutation(api.labs.generateImageUploadUrl, {});
  const bigPost = await fetch(bigUrl, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: new Uint8Array(6 * 1024 * 1024),
  });
  assert(bigPost.ok, `over-limit storage POST failed: ${bigPost.status}`);
  const big = (await bigPost.json()) as { storageId: string };
  const bigFin = await client.mutation(api.labs.finalizeImageUpload, {
    storageId: big.storageId as Id<"_storage">,
  });
  if (bigFin.ok !== false) {
    throw new Error("ASSERTION FAILED: over-limit finalize was accepted");
  }
  if (!bigFin.error.includes("max 5 MB per file")) {
    throw new Error(
      `ASSERTION FAILED: free-tier per-file cap not enforced: ${bigFin.error}`,
    );
  }
  let bigRetry = "";
  try {
    await client.mutation(api.labs.finalizeImageUpload, {
      storageId: big.storageId as Id<"_storage">,
    });
  } catch (e) {
    bigRetry = String((e as Error).message);
  }
  assert(
    bigRetry.includes("Uploaded file not found"),
    `rejected over-limit blob was not deleted: ${bigRetry}`,
  );
  console.log(
    "  ✓ membership tier gate: 6 MB rejected for free tier, blob cleaned up",
  );

  // 6. Orphan cleanup — unreferenced upload is discarded, URL then 404s.
  const disc = await client.mutation(api.labs.discardImage, {
    storageId: storageId as Id<"_storage">,
  });
  assert(disc.removed === true, `discard removed: ${disc.removed}`);
  const gone = await fetch(fin.url);
  assert(gone.status === 404, `expected 404 after discard, got ${gone.status}`);
  console.log("  ✓ discard removed the orphan; URL now 404s");

  console.log("\nALL CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
