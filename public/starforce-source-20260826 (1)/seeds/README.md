# Demo Seed — Operator Runbook

> One-shot demo data for Star Force Base 1198.
> Lives at `src/convex/seed.ts` → exported action `seed:seedDemo`.
> Idempotent on slugs and displayNames — re-running won't duplicate.

## What it inserts

| Table | Quantity | Source |
| --- | --- | --- |
| `users` | 12 | Operator (Cmdr. Vega) + 11 members across all 5 tiers with curated `achievements` ids |
| `stories` | 7 | Includes 2 featured, 1 submitted draft, 4 published |
| `loreEntries` | 8 | Includes 3 featured (Sol system-Gemini, Outer Belt, Cmdr. Singh) |
| `transmissions` | 4 | Includes 1 featured with cover + `videoUrl` (Google CDN sample) |
| `sectorMap` | 6 | Already running the SVG map widget |
| `resources` | 6 | Includes one tier-gated (`command`) |
| `missions` | 3 | Cadet / Outer Belt / Q4 review |
| `fleetReports` | 3 | Some authored by specific seeded users |
| `groups` | 4 | Sector Patrol, Cartographers' Guild, Listening Post Ops, Bridge Council |
| `forumThreads` | 6 | Including the "Favorite sci-fi weapons" / "Alien species theories" / "New fleet tactics" threads |
| `activityFeed` | 5 | Published / published_lore / messaged / filed_report entries |
| `moderationItems` | 2 | Demo queue for `/operator/moderation` |
| `identityVerifications` | 1 | Demo row for `/operator/identity` |
| `auditLog` | 1 | Demo row for `/operator/audit` |

Plus **6 cover images** attached to the 2 featured stories, 3 featured
lore entries, and 1 featured transmission via `coverStorageId` +
`coverMeta`.

## Cover images: real sci-fi from the web, with SVG fallback

Each cover tries to fetch a **real public-domain sci-fi image** via
`ctx.fetch` from a fixed list of stable Wikimedia Commons URLs. If the
fetch fails for any reason (network glitch, redirect, stale URL, blocked
UA), the seed falls back to a procedural SVG so the home page never
renders empty covers.

| Cover | Wikimedia source URL (NASA / Hubble / Webb) | Fallback palette |
| --- | --- | --- |
| `story-signal-sol` | Carina Nebula (Webb NIRCam) | cyan/violet |
| `story-outer-belt` | Pillars of Creation (Hubble 2014) | amber/void |
| `lore-sol-system` | Sombrero Galaxy (Hubble visible) | sapphire |
| `lore-outer-belt` | Andromeda (M31) | emerald/cyan |
| `lore-cmdr-singh` | Crab Nebula | magenta/gold |
| `transmission-bridge-041` | Saturn (Equinox) | cyan/violet |

Wikimedia's upload CDN rejects bare-UA requests, so the `ctx.fetch`
call sends `User-Agent: Mozilla/5.0 (Convex seed; Starforce Base 1198) …`.
If the Wikimedia UA policy tightens and the requests start returning 403,
update the User-Agent string in `fetchOrBuildCover` (or update the URLs
themselves) and re-deploy — every cover will still resolve to the
procedural SVG fallback in the meantime.

Cover size is bounded to thumbnails (~1MB each, 6 covers = ~6MB
download inside the action). Convex action outbound bandwidth and 5-min
runtime budget both accommodate this comfortably.

## Implementation note (action + internal mutations, Node.js runtime)

`seed:seedDemo` is an **action** running in the **Node.js runtime**
(`"use node";` at top of file). The Node.js runtime is required because
`ctx.fetch` — used to download real sci-fi cover images from Wikimedia —
is only available in the Node.js runtime, not the default V8 isolate.

The orchestration goes:

1. **Action body** — for each of 6 covers, call `fetchOrBuildCover(ctx, spec)`
   which returns a `{ storageId, byteSize, mimeType, source, fetchError? }`
   resolved at runtime. `source` is `"fetched"` for real images or
   `"svg-fallback"` when the fetch failed (with `fetchError` carrying the reason).
2. **Internal helper mutations** in `src/convex/seedHelpers.ts` perform
   each data-table insert via `ctx.runMutation(internal.seedHelpers.foo, ...)`.
   Each helper is idempotent on the table's natural key (slug or
   `displayName`) or is a "no-op if the table already has rows" helper.
3. The action **returns** `{ ok: true, seededAt: <epoch-ms> }`.

This split exists because `ctx.storage.store` is read-only inside mutations
in this Convex runtime. The previous mutation crashed with
`t.storage.store is not a function` when trying to upload procedural SVG
covers — moving the cover-upload step into an action fixed that. Public
surface (`seed:seedDemo {"clear": true}`) is unchanged.

## Invocation paths

### Path C — Dashboard Functions tab (no CLI auth required)

1. Visit `https://dashboard.convex.dev/t/vly/test-db5fd/functions`.
2. Search for `seed:seedDemo`.
3. Click → **Run function**. Paste this in the Args field:

   ```json
   { "clear": true }
   ```

4. Hit **Run**. Expected response:

   ```json
   {
     "ok": true,
     "seededAt": 1736300000000,
     "covers": [
       { "key": "story-signal-sol", "source": "fetched" },
       { "key": "story-outer-belt", "source": "fetched" },
       { "key": "lore-sol-system", "source": "fetched" },
       { "key": "lore-outer-belt", "source": "fetched" },
       { "key": "lore-cmdr-singh", "source": "fetched" },
       { "key": "transmission-bridge-041", "source": "fetched" }
     ]
   }
   ```

   If any cover fell back to SVG, its `source` will be `"svg-fallback"`
   and `fetchError` will contain the reason (e.g. `"fetch is not a function"`
   means the action isn't running in the Node.js runtime).

The action may take 10–30 seconds on the first run because it fetches
six external images via the Node.js runtime's `fetch`; subsequent runs are
similar (covers are re-fetched and re-uploaded each time). If the action
returns instantly with all `"svg-fallback"` sources and `"fetch is not a function"`
errors, the deployment is missing the `"use node";` directive — re-deploy.

### Path A — Deploy-key CLI

```bash
export CONVEX_DEPLOY_KEY="<paste token here>"
cd <repo root>
bunx convex run seed:seedDemo '{"clear": true}'
```

### Path B — Local `bun convex dev`

```bash
cd <repo root>
bun convex dev
```

A browser OAuth flow resolves in your own terminal; the cached token
subsequently lets the seed run from anywhere.

## What `clear: true` does

Wipes the seed tables (stories, lore, transmissions, resources, missions,
fleetReports, groups, forumThreads, sectorMap, moderationItems,
identityVerifications, auditLog, comments, activityFeed, notifications)
**before** inserting. `users` is intentionally excluded — re-seeding
does not orphan authored content. If you want a full user wipe, run a
separate dashboard Data tab cleanup first.

## Idempotency rules

Each helper checks for existing rows before insert:

- `seedStories / seedLore / seedTransmissions / seedResources /
  seedMissions / seedGroups / seedThreads` — by `slug`.
- `seedUsers` — by `displayName`.
- `seedSectors / seedFleetReports / seedActivity / seedModeration /
  seedIdentity / seedAudit` — skip if the table has any rows.

Cover images are **always** re-uploaded on every run. After many
re-runs, orphaned `coverStorageId`s accumulate; refresh an unwanted row
via the operator Content Desk's **Remove** button — that calls
`assets:removeStoryCover` etc., which deletes the underlying storage
asset.

## Swapping procedural covers for real uploads

Even with the new Wikimedia pipeline, operators retain the ability to
swap any cover for a handpicked file:

1. Sign in as `operator` / `senior_operator` / `story_editor` /
   `lore_archivist` (capability-gated in `convex/operator.ts`).
2. Operator console → **Content Desk**.
3. Pick the matching row → **Edit**.
4. After row save, the **Cover image** widget appears at the top of the
   modal. Click **Upload cover** and select a JPEG / PNG / WebP / AVIF
   (≤ 5 MB).
5. The new cover replaces the Wikimedia asset; the prior storage asset
   is garbage-collected automatically. Featured flags stay intact.

The schema validator is `v.optional(...)` on `coverStorageId` /
`coverMeta`, so removing a cover is also supported via the same panel's
**Remove** button.

## Known caveats

- Wikimedia URL paths occasionally rotate. If a path stops resolving,
  update the URL in `COVER_URLS` (see top of `src/convex/seed.ts`) and
  re-deploy — the seed will pick up the new URL on the next run.
- The featured transmission's `videoUrl` is now real NASA footage:
  Orion camera views from the Artemis II apogee raise burn, served from
  `images-assets.nasa.gov` (public domain, `~mobile.mp4` rendition,
  84 MB, byte-range supported). If NASA ever rotates the asset, swap
  the `VIDEO_URL` constant at the top of `src/convex/seed.ts` and
  re-run the seed.
- Achievements referenced in seeded user rows must match ids in
  `src/lib/achievements.ts` or the badge widget falls back to the raw id.
- Re-running `seed:seedDemo {"clear": false}` is safe; re-running with
  `{"clear": true}` creates orphan storage IDs each pass because cover
  uploads don't dedup against previously stored covers. Use the operator
  Content Desk → Remove button to clean up if it matters.
