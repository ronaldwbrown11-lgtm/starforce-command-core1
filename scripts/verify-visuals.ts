// =========================================================================
// Headless end-to-end check of the visual creation system backend.
//
// Exercises (with an anonymous session, same as verify-lab-upload.ts):
//   1. auth/operator gates refuse strangers
//   2. upload → createAsset → pending (member submission)
//   3. visibility: pending hidden from the public list, visible to the author
//   4. storyboard save → export-to-gallery → public visibility → cleanup
//   5. artist profile upsert → roster → cleanup
//   6. owner removal of the asset (orphan-free teardown)
//
// Usage: bun scripts/verify-visuals.ts
// =========================================================================

import { ConvexHttpClient } from "convex/browser";
import { api } from "../src/convex/_generated/api";
import type { Id } from "../src/convex/_generated/dataModel";

const CONVEX_URL =
  process.env.CONVEX_URL ?? "https://lovely-koala-228.convex.cloud";

const PNG_BYTES = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (c) => c.charCodeAt(0),
);

const TITLE = "E2E Probe Artwork";
const BOARD = "E2E Probe Board";
const ARTIST = "E2E Probe Artist";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function expectThrow(fn: () => Promise<unknown>, label: string) {
  try {
    await fn();
  } catch (e) {
    console.log(
      `  ✓ ${label} refused: ${String((e as Error).message).slice(0, 80)}`,
    );
    return;
  }
  throw new Error(`ASSERTION FAILED: ${label} should have thrown`);
}

async function main() {
  console.log("Visual creation system — headless E2E against", CONVEX_URL);

  // 1. Gates.
  const stranger = new ConvexHttpClient(CONVEX_URL);
  await expectThrow(
    () => stranger.mutation(api.visuals.generateUploadUrl, {}),
    "unauthenticated generateUploadUrl",
  );
  await expectThrow(
    () => stranger.query(api.visuals.reviewQueue, {}),
    "unauthenticated reviewQueue (operator gate)",
  );

  const client = new ConvexHttpClient(CONVEX_URL);
  const auth = await client.action(api.auth.signIn, {
    provider: "anonymous",
    params: {},
  });
  const token = "tokens" in auth ? auth.tokens?.token : undefined;
  assert(token, "anonymous sign-in returned no tokens");
  client.setAuth(token!);
  console.log("  ✓ anonymous session established");

  // 2. Upload + createAsset (member → pending).
  const uploadUrl = await client.mutation(api.visuals.generateUploadUrl, {});
  const post = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: PNG_BYTES,
  });
  assert(post.ok, `storage POST failed: ${post.status}`);
  const { storageId } = (await post.json()) as { storageId: string };
  const created = await client.mutation(api.visuals.createAsset, {
    storageId: storageId as Id<"_storage">,
    title: TITLE,
    fileName: "probe.png",
    kind: "concept",
    species: "Probe Species",
    attribution: ARTIST,
    era: "Probe Era",
    downloadAllowed: true,
  });
  if (created.ok !== true) {
    throw new Error(`ASSERTION FAILED: createAsset rejected: ${created.error}`);
  }
  assert(created.status === "pending", `status: ${created.status}`);
  console.log("  ✓ asset created, status:", created.status);

  // 2b. Membership tier gate — free tier caps files at 5 MB. Rejections
  // RETURN { ok: false } (a thrown mutation would roll back the blob
  // delete), and the blob must actually be gone afterwards.
  const bigUrl = await client.mutation(api.visuals.generateUploadUrl, {});
  const bigPost = await fetch(bigUrl, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: new Uint8Array(6 * 1024 * 1024),
  });
  assert(bigPost.ok, `over-limit storage POST failed: ${bigPost.status}`);
  const { storageId: bigId } = (await bigPost.json()) as { storageId: string };
  const rejected = await client.mutation(api.visuals.createAsset, {
    storageId: bigId as Id<"_storage">,
    title: "Over-limit probe",
    kind: "concept",
  });
  if (rejected.ok !== false) {
    throw new Error("ASSERTION FAILED: over-limit createAsset was accepted");
  }
  if (!rejected.error.includes("max 5 MB per file")) {
    throw new Error(
      `ASSERTION FAILED: free-tier per-file cap not enforced: ${rejected.error}`,
    );
  }
  let retryMsg = "";
  try {
    await client.mutation(api.visuals.createAsset, {
      storageId: bigId as Id<"_storage">,
      title: "Over-limit probe retry",
      kind: "concept",
    });
  } catch (e) {
    retryMsg = String((e as Error).message);
  }
  assert(
    retryMsg.includes("Uploaded file not found"),
    `rejected blob was not deleted: ${retryMsg}`,
  );
  console.log(
    "  ✓ membership tier gate: 6 MB rejected for free tier, blob cleaned up",
  );

  // 3. Visibility rules.
  const publicList = await stranger.query(api.visuals.listAssets, {
    search: TITLE,
  });
  assert(publicList.length === 0, "pending asset leaked to the public list");
  const mine = await client.query(api.visuals.listAssets, {
    mine: true,
    search: TITLE,
  });
  assert(mine.length === 1, `mine: ${mine.length}`);
  assert(mine[0].url && mine[0].url.includes("/lab-image/"), "asset url");
  console.log("  ✓ pending hidden publicly, visible to author, url resolves");

  // 4. Storyboard lifecycle.
  const sb = await client.mutation(api.visuals.saveStoryboard, {
    title: BOARD,
    summary: "E2E probe sequence",
    panels: [
      {
        imageId: created.id as Id<"visualAssets">,
        caption: "Panel one",
        scene: "EXT. PROBE STATION",
      },
    ],
    missionLink: "Probe Mission",
  });
  const strangerBefore = await stranger.query(api.visuals.listStoryboards, {});
  assert(
    !strangerBefore.some((s) => s.title === BOARD),
    "unpublished storyboard leaked",
  );
  await client.mutation(api.visuals.exportStoryboard, {
    id: sb.id as Id<"storyboards">,
    publish: true,
  });
  const strangerAfter = await stranger.query(api.visuals.listStoryboards, {});
  assert(
    strangerAfter.some((s) => s.title === BOARD),
    "published storyboard not visible",
  );
  const publishedSb = strangerAfter.find((s) => s.title === BOARD)!;
  assert(
    publishedSb.panels[0]?.url?.includes("/lab-image/"),
    "storyboard panel url not resolved",
  );
  console.log("  ✓ storyboard save → export → public visibility → panel urls");

  // 5. Artist profile lifecycle.
  const prof = await client.mutation(api.visuals.upsertArtistProfile, {
    displayName: ARTIST,
    bio: "E2E probe bio",
    mediums: "Digital",
    commissionAvailable: false,
    socialLinks: [{ label: "Site", url: "https://example.com" }],
  });
  assert(prof.ok, "profile upsert");
  const roster = await stranger.query(api.visuals.listArtists, {});
  assert(
    roster.some((r) => r.displayName === ARTIST),
    "artist missing from roster",
  );
  const me = await client.query(api.visuals.myArtistProfile, {});
  assert(me?.userId, "myArtistProfile missing");
  const detail = await stranger.query(api.visuals.artistProfile, {
    userId: me!.userId,
  });
  assert(detail.displayName === ARTIST, "artist profile detail");
  assert(detail.assets.length === 0, "pending asset leaked on profile");
  console.log("  ✓ artist profile upsert → roster → detail (visibility held)");

  // 6. Teardown — owner removal, everything gone afterwards.
  await client.mutation(api.visuals.removeStoryboard, {
    id: sb.id as Id<"storyboards">,
  });
  await client.mutation(api.visuals.removeAsset, {
    id: created.id as Id<"visualAssets">,
  });
  await client.mutation(api.visuals.removeArtistProfile, {});
  const afterPublic = await stranger.query(api.visuals.listAssets, {
    search: TITLE,
  });
  const afterRoster = await stranger.query(api.visuals.listArtists, {});
  const afterSb = await stranger.query(api.visuals.listStoryboards, {});
  assert(afterPublic.length === 0, "asset not removed");
  assert(!afterRoster.some((r) => r.displayName === ARTIST), "profile not removed");
  assert(!afterSb.some((s) => s.title === BOARD), "storyboard not removed");
  const gone = await fetch(mine[0].url!);
  assert(gone.status === 404, `storage not deleted: ${gone.status}`);
  console.log("  ✓ teardown complete — asset, board, profile, storage all gone");

  console.log("\nALL CHECKS PASSED");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
