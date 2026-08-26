# Star Force Base 1198 — Site Owner's Admin Guide

A plain-language guide for running the site day to day. No code knowledge needed.
Written for the site owner (Cmdr. Vega / operator).

---

## 1. The three parts of your site

| Part | Where it lives | What it is |
| --- | --- | --- |
| **The Website** | Hostinger (`public_html/`) | The static files (`index.html`, `assets/`, `.htaccess`) that visitors' browsers load. This is what you upload when there's a new build. |
| **The Database** | Convex Cloud (`https://lovely-koala-228.convex.cloud`) | Every user, story, mission, report, forum post, message, comment. It is a separate cloud service — **not on Hostinger, and never inside the upload zip**. The website talks to it automatically. |
| **The Admin Console** | Inside your own site (`/operator`) | Your daily dashboard for running the platform — users, content, moderation, analytics. |

**The single most important fact:** uploading a new website build **never touches the database**. Your data is separate from your files. You cannot lose or damage data by uploading — and a broken upload is always fixable by uploading a previous good zip.

---

## 2. Where to administer

### 2a. Operator Console — your daily admin (recommended)

Sign in with your account email, then visit **`/operator`**. It contains:

- **Dashboard** — key stats, pending moderation, story approvals, system health
- **Users** — manage members: ranks, tiers, roles, activity
- **Content** — the Content Desk: stories, lore, transmissions, resources, missions (create/edit briefings, feature content)
- **Stories** — story submission & approval workflow
- **Lore Library** — lore entries and library assets
- **Moderation** — reported content queue (approve / reject / escalate)
- **Reports** — field-report review (mission report-ins)
- **Identity** — member identity verification requests
- **Sessions** — who is signed in and where
- **Logins** — login history
- **Audit** — a full change log of operator actions
- **Analytics** — platform usage and growth
- **Health** — system status overview
- Plus: **Broadcasts**, **Featured**, **References**, **Support**, **Team**

**How you get operator access:** the demo seed created *Cmdr. Vega* (`admin@starforce.local`) as `senior_operator`, but that address isn't a real mailbox. The practical way is to sign up with **your own email**, then ask the development assistant to promote your account to an operator role. One message is all it takes.

### 2b. Convex dashboard — raw data access (optional)

You can also view and edit the raw database directly:

**`https://dashboard.convex.dev/t/ronald-brown/starforce-chronicle-main/lovely-koala-228`**

- **Data tab** — browse every table (users, stories, missions, …), inspect or edit any row
- **Functions tab** — run backend functions manually (e.g. `seed:seedDemo`)
- **Export** — back up the entire database

Caveat: the dashboard signs in with the Convex account that owns the project. If you can't get in, that's fine — every data task (exports, row fixes, bulk edits, reports) can be requested from the development assistant, who can also export/import the whole database for you.

---

## 3. How changes reach your live site

1. **Request the change** — tell the development assistant what you want (copy, features, design, data).
2. **Build & check** — the change is implemented and the platform automatically type-checks it.
3. **Fresh package** — a new production build is created and the downloads page (`/download.html`) is refreshed with new files and their SHA-256 checksums.
4. **Download** — get the **Built website (dist) zip** from `/download.html`.
5. **Verify** — check the SHA-256 (instructions are on the downloads page). It must match exactly.
6. **Upload** — Hostinger → Files → File Manager → `public_html/` → delete the old `index.html` and `assets/` → upload the zip → **Extract** → confirm `index.html` and `.htaccess` are directly in the folder.
7. **Test** — open the homepage and a deep link such as `https://starforcebase1198.com/missions`.

Nothing else. The database needs no setup, no migration, no changes on upload.

---

## 4. The safety rules

1. **Only upload the dist zip** — never the source-code zip (that one is your backup, keep it off the server).
2. **Always verify the SHA-256** before uploading. A mismatched hash means a bad download — re-download.
3. **Keep the previous verified zip** until the new site is confirmed working. That is your rollback.
4. **The database is never in the zip.** You cannot break data with an upload.
5. If a new build misbehaves, re-upload the previous verified zip to revert instantly.

---

## 5. Common data tasks — just ask

- Back up / export the entire database
- Fix, edit, or delete specific rows
- Promote an account to moderator / operator / story editor
- Grant or change membership tiers
- Generate reports (users, content, activity)
- Move everything to a new Convex project (export + import)

---

## Appendix: quick reference

| Thing | Where |
| --- | --- |
| Live site | `https://starforcebase1198.com` |
| Downloads page | `https://starforcebase1198.com/download.html` |
| Admin console | `https://starforcebase1198.com/operator` |
| Database (Convex Cloud) | `https://lovely-koala-228.convex.cloud` |
| Convex dashboard | `https://dashboard.convex.dev/t/ronald-brown/starforce-chronicle-main/lovely-koala-228` |
| Database design (schema) | `src/convex/schema.ts` in the source code |
| Deployment runbook | `DEPLOYMENT.md` in the source code |
