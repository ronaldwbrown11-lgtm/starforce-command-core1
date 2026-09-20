# Star Force Base 1198 — Six-Month Growth Plan (Standing Directive)

> **Status:** Living document — the authoritative phase schedule for the Star Credits
> economy. Phase 1 is **built and deployed**. Implement each later phase at its
> interval below; do not skip ahead, and keep every addition cosmetic/consumable
> (never sell moderation influence, approvals, or rank).

**Start of schedule:** first ship after 2026-09-20 (the date Phase 1 landed).

---

## Phase 1 — Months 1–2 · Make the economy real ✅ BUILT

| Item | Detail | Status |
| --- | --- | --- |
| Cosmetic Lab expansion | Frames dress full card + header badge; 4 tints (Ion 250★, Void 350★, Terra 400★, Admiral 500★) | ✅ Live |
| Titles | Signal Warden 300★, Void Cartographer 450★, Starforge Smith 450★, Keeper of the Deep Canon 900★; mission line (Fleet Honor, Signal Legend) operator-award-only via `operator:awardTitle` | ✅ Live |
| Boosts (consumables) | XP Surge 2× XP/24h 500★ · Credit Surge 2× credits/24h 750★ — enforced server-side in `applyXpGain`/`grantCredits`, stack to 7 days | ✅ Live |
| Weekly rotation shelf | Deterministic ISO-week spotlight (one frame + one title), fleet-wide, no cron (`weeklySpotlight`) | ✅ Live |
| Store ↔ credits bridge | Store product kind `credits` + `creditAmount`; Stripe fulfillment grants exact credits (no surge multiplier), audit-logged | ✅ Built — operator creates cache products in Store Manager to activate |

**Earning rates (faucet):** story 100★ · lore 25★ · discovery 25★ · mission report 10★ · comment 5★ (+quests, contests, vault ciphers).

---

## Phase 2 — Months 2–3 · Social spending

- **Credit gifting / tipping** on stories and lore (authors earn from fans; creator economy begins).
- **Display cases** on profiles — show owned cosmetics + trophies.
- **Group treasuries** — pooled credits for banners, group titles, private channels.
- Operator console panel to award titles/credits directly from a member's detail page (backend `adjustUserCredits` + `awardTitle` already exist).

## Phase 3 — Months 3–4 · Recurring events drive demand

- **Seasonal Cosmetic Pass** — limited-edition frames per season; numbered editions (e.g. Founder's Frame 078/100).
- **Weekly contest entry fees** (credits) with merch prize pools.
- **Community goals** — base-wide credit contributions unlock canon content (lore chapter / sector reveal).

## Phase 4 — Months 4–5 · Premium + partnerships

- **Lore rentals** — 48h access to tier-gated archives (free → paid funnel).
- **Creator program** — members sell custom lore bibles/art in the store; platform takes a cut.
- **ARG campaigns** with credit bounties (Signal Vault integration).

## Phase 5 — Month 6 · Polish & scale

- **Credit economy dashboard** in operator console — earn/spend charts, inflation monitoring.
- **Achievement-linked cosmetics** — milestone frames earned, not bought.
- **Referral rewards** — credits for recruiting active new members.

---

## Recurring engagement loops (continuous, all phases)

- Daily login streak bonus (small credits, escalating weekly).
- "Mission of the week" — featured mission pays 3× credits.
- Flash sales in the Requisition Depot (48h), announced via Fleet Status banner.
- Operator-curated monthly "canon artifact" drops (premium-priced, lore-rich).
- Patron badge — permanent marker for members who've spent X credits total.

## Economy hygiene rules (enforce continuously)

1. Rotate 3–4 Lab items weekly; retired items return seasonally.
2. Keep 1–2 aspirational sinks at 5,000–10,000★.
3. Anti-farm caps on faucet sources (e.g. 25★/day from comments).
4. Never sell power over people — boosts and speed yes; votes, approvals, roles no.

## Where this plan surfaces to users

- **Cadet Manual** (`/manual`) — onboarding guide with the economy section and a
  download link to `public/downloads/starforce-growth-plan.pdf` (7-page PDF,
  regenerate via `bun scripts/generate-growth-plan.mjs` when the plan changes).
- **FAQs** — Star Credits / Cosmetic Lab / boosts / real-money entries in
  `src/lib/faqSeed.ts` (re-seed FAQ table after edits).
