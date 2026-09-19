
## Addendum — Member funnel (found in follow-up audit)

The member onboarding funnel had additional wiped dependencies missed in the
first pass. Restored 2026-09-19 via one-shot replication of the operator-gated
seed mutations (factions:seed, groups:seedCanonShipGroups):

| Table | Restored | Source |
| --- | --- | --- |
| factions | 33 canon factions | src/lib/factions.ts SEED_FACTIONS |
| groups (ship formations) | 35 canon ship groups | src/lib/ships.ts ALL_SHIP_GROUPS |

Funnel steps now fully served: profile (users), ship assignment
(src/lib/ships.ts hull catalog — code-defined, was never lost), group join
(45 groups incl. auto-enroll formations), quest steps (code-defined).

Still missing (operator/user-created only — requires Convex backup):
siteAppearance backgrounds, blogPosts, storeProducts, socialLinks, faqItems,
vessels, contests, /lore/test, pre-wipe uploaded images, audit history.
