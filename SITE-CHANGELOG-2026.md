# Star Force Base 1198 — Site Change History (Aug 1 → Sep 4, 2026)

Reconstructed from the surviving snapshots in this project. Each section lists
what shipped in that window, with the artifact that proves it.

> **Important gap:** no source snapshot from **Aug 29 – Sep 2** survives in the
> project. The Convex "migration" incident happened in that window and the
> project state today equals the **Aug 28 layer + Sep 3–4 repairs**. If further
> edits were made in those four days, they are not present in any archive,
> zip, or backup inside this workspace.

---

## Baseline — Aug 10 (oldest full source snapshot)

- 28 pages, 28 Convex modules, 91 components (~37,000 lines of TS/TSX).
- Core site already live: Home, Stories, Lore + Lore Detail + Lore Submit,
  Missions, Forums, Groups, Members, Messages, Profile, Account, Membership,
  Search, Resources, Support, Privacy/Terms.
- Member suite: XP tiers (`tiers.ts`), social module (`social.ts`), messages,
  groups, missions, content + lore library, support ticketing.
- Operator console already had 20 screens (Dashboard, Content, Stories,
  Moderation, Reports, Users, Team, Identity, Logins, Sessions, Health,
  Analytics, Lore Library, References, Broadcasts, Audit, FAQs-era …).
- Backend: auth (email OTP) + Stripe + usage tracking + rate limiting.
- Database backup saved **Aug 10** (this week's earlier content baseline).

---

## Aug 11 – 15 — Deployment pipeline & external archives

- **Aug 11** — fresh source + dist backups archived (`backups/old-downloads-2026-08-11/`).
- **Aug 13** — **Armory subdomain app wiring** (`armory-database-wiring.zip`).
- **Aug 15** — first Hostinger dist backup (`backup-hostinger-dist.zip`).

---

## Aug 16 – 24 — Content systems & fleet database era (snapshot Aug 24)

**New pages:** Blog + Blog Detail, FAQs, Maps (sector charts), Star Atlas
(interactive map), Lore Database (`/lore/databases/:slug` records), first
**Fleet Registry** React page (rich card grid with search + class filters).

**New backend modules:** `vessels.ts` (+ **37-vessel Convex import on Aug 24**),
`blog.ts`, `faqs.ts`, `sectorMap.ts`, `discoveries.ts`, `canonScanner.ts`
(+ helpers), `siteAppearance.ts` (DB-driven page themes/backgrounds),
`sitemap.ts`.

**New widgets/components:** Armory Browser, Discovery Map, Pilot Onboarding,
Canon rescan panels, File Picker.

**New operator screens:** Appearance, Blog Manage, Discoveries, FAQs Manage,
Fleet Manage, Sector Map.

**External apps & archives:**
- `starforcebase1198-dist-20260824-0615.zip` + `starforce-deploy.zip` (Aug 24).
- `fleetregistry-fix.zip` (Aug 24 evening) — external fleet-registry subdomain
  app + schema/API files (`fleetregistry-schema.sql`, `fleetregistry-api.php`,
  `fleetregistry-server.js`).
- The **external subdomain apps** (`personnel.`, `armory.`, `fleetregistry.`)
  were wired as the lore-library database frontends.

---

## Aug 25 – 26 — Nighthawk + registry embed switch (snapshot Aug 26)

- **Nighthawk vehicle database** subdomain app: `nighthawk.ts`, Nighthawk Queue
  operator screen, install SQL + config, package archive (Aug 25).
- `staticCovers.ts`, `FleetBrowser` widget.
- `github-fix.zip` (Aug 25) — GitHub Actions auto-deploy repair.
- **Fleet Registry page was switched to EMBED the external subdomain app**
  (`fleetregistry.starforcebase1198.com/registry`) — the two React registry
  designs that existed before/after were not part of this state.
- ~50 files changed across the repo in this window.

---

## Aug 26 – 28 — The big community/social layer (what is LIVE today)

This is the batch of upgrades built in the last week of August. **This layer is
what the live site currently serves**, not a weeks-old design:

- **Social hub:** `/community` (feed + spotlight + trending + captain's log),
  `/activity` (compose box, notifications, auto-paging feed), header
  notification bell with unread badge, reactions on lore/threads/reports,
  live comments.
- **Gamification:** rank/XP progression (`achievements.ts`), lore-themed badge
  set, leaderboard with podium (`/leaderboard`), Star Credits economy +
  cosmetic lab (profile frames), Signal Vault with ciphers for XP/credits.
- **Community tools:** Events calendar (`/events`), Captain's Log
  (`captainLog.ts`), `/changelog` + operator Changelog Manage, social-links
  manager (`socialLinks.ts` + operator screen + DB-driven **footer "Follow Us"**
  icons).
- **Fleet archives:** `/fleet-registry/service-histories`,
  `/fleet-registry/armament-sheets`, `/fleet-registry/black-box-files`
  (`fleetRecords.ts`).
- **New pages:** Leaderboard, Events, Changelog, Signal Vault, EmbedStory,
  AI Tools Assistant.
- **New backend:** `achievements`, `economy`, `signals`, `captainLog`,
  `changelog`, `events`, `fleetRecords`, `socialLinks`, `digest` (+ data),
  `cronJobs`, `rateLimit`/`otpRateLimit`, `storage` (+ helper),
  `aiAssistant` (+ helpers).
- **New widgets:** CaptainLogPanel, ContinueReading, Flair, MiniBadgeRow,
  StarCreditsCard, StorageManager + CookieConsent, ShareButtons.
- **Shell:** mega-menu navigation rewrite + new footer (SiteShell grew
  437 → 634 lines), Spanish locale support (`i18n.tsx`).
- ~55 files changed; ~20 new modules.
- Operator changelog entries logged during this window (in-app, `/changelog`):
  - **Aug 20** — Leaderboard + notifications polish.
  - **Aug 23** — Events calendar + Captain's Log.
  - **Aug 26** — Ranks, badges, Signal Vault, Star Credits.

Live content at this layer: 37 vessels, 7 approved lore-library records +
8 lore entries, 6 published stories, 13 cadets/members, 10 groups, 6 forum
threads, 3 missions, 3 fleet reports, 3 captain's-log entries, 5 activity
events.

---

## Aug 29 – Sep 2 — ⚠ No surviving artifact (incident window)

The Convex "migration" was started by mistake and paused, email OTP delivery
broke (Resend domain never verified), and the site briefly black-screened.
No source snapshot from these dates exists in the workspace. Any edits made in
this window are unrecoverable from this environment — only the Freebuff
platform or the GitHub deploy repo could hold them.

---

## Sep 3 – 4 — Repairs (current session)

- Boot-screen fallback + invalid-URL guard (no more silent black screen).
- Restored the public Convex endpoint (`lovely-koala-228.convex.cloud`).
- `.htaccess` SPA asset-rewrite safeguard; regenerated deployment archives
  with matching hashes.
- Restored the Freebuff OTP relay path in `emailOtp.ts` (backend var
  `FREEBUFF_OTP_RELAY_KEY`; Resend kept as fallback — domain verification
  still pending).
- Lore-library database records repaired in code + seed:
  Sector Atlas → built-in `/map`, Signal Intelligence → built-in `/vault`,
  dead `*.starforce.local` hosts remapped to the live subdomains; operator
  form placeholders fixed.
- Groups page stale-hostname display removed.
- Docs refreshed: `download.html`, `AUTO-DEPLOY-SETUP.md`, `DEPLOYMENT.md`.
- **Sep 4 — Fleet Registry now embeds the external subdomain app**
  (`fleetregistry.starforcebase1198.com/registry`) per operator request; both
  React registry implementations (card grid and row list) were removed from
  that page.

---

## Where to find the versions

| Snapshot | Artifact |
|---|---|
| Jul 8 | `snapshot-dev.zip` / `snapshot-prod.zip` (inside Aug 24 archive) |
| Aug 10 | `starforce-backup-source.tar.gz` (inside Aug 24 archive) + `backups/old-downloads-2026-08-11/backup-source.txt` |
| Aug 15 | `public/backup-hostinger-dist.zip` |
| Aug 24 | `public/starforce-source.tar.gz`, `public/starforcebase1198-dist-20260824-0615.zip` |
| Aug 26 | `public/starforce-source-20260826.tar.gz` |
| Aug 28 = current pre-Sep-3 | the tree this project is built from |
| Sep 4 | current source + `public/starforce-dist-latest.tar.gz` |
