# Star Force Base 1198 — Deployment Runbook

Production deployment guide for the React (Vite) + Convex application.
Canonical domain: **https://starforcebase1198.com** (already baked into
`sitemap.xml`, `robots.txt`, `manifest.webmanifest`, and the email `SITE_URL`
default).

---

## 1. Architecture

| Layer    | Tech                      | Where it runs                          |
| -------- | ------------------------- | -------------------------------------- |
| Frontend | React 19 + Vite SPA       | Static host serving `dist/`            |
| Backend  | Convex (queries/mutations/actions, DB, auth, file storage, cron) | Convex Cloud (already deployed) |
| Edge HTTP| `src/convex/http.ts`      | Convex HTTP routes (`/stripe-webhook`, auth routes) |

The frontend is a pure static build: no Node server required at runtime.
Every dynamic feature (auth, data, uploads, webhooks) is served by Convex.

## 2. Production build & checks (all verified ✅ on this branch)

```bash
bun run build          # tsc -b && vite build && build:isolate  → passes
bun test               # 26 tests, 0 fail
bun convex dev --once  # backend codegen + typecheck
```

- Build output: `dist/` (plus `isolate/`, the in-platform mirror).
- No `localhost` / `127.0.0.1` references remain in `src/` or `public/`.
- Known (non-blocking) build notes: an empty `convex-vendor` chunk is emitted
  (harmless); the main bundle is ~912 kB raw / ~250 kB gzip because the app
  deliberately avoids code-splitting (see `src/main.tsx` comment). A
  performance pass is a separate follow-up task.

### Backup archives (`public/download.html`)

The two downloadable backup archives (`backup-hostinger-dist.*` and
`backup-hostinger-source.*`, served as renamed `.txt`/`.zip` files from
`public/`) are built with **explicit file lists** and **must exclude** the
downloads page and PDF guides, so the SHA-256 checksums printed on
download.html stay stable no matter how often that page is edited:

- Dist archive: `tar -czf <out> index.html assets logo.svg manifest.webmanifest robots.txt sitemap.xml .htaccess`
  (no `download.html`, no backups — those are site files, not deployables).
- Source archive: explicit top-level file list (`src public seeds`, configs,
  `ADMIN-GUIDE.md`, …) with `--exclude='public/backup-*'`,
  `--exclude='public/download-*'`, `--exclude='public/download.html'`,
  `--exclude='public/*.pdf'` and `--exclude='backups'` (private Convex
  snapshot exports live in `backups/` and must never ship) — plus
  `node_modules`, `dist`, `isolate`, `.git`, `.DS_Store`.
- Private database snapshots: `bunx convex export --include-file-storage
  --path backups/database-backup-YYYY-MM-DD.zip` (restorable via
  `convex import`). These are NOT published on the downloads page.
- After regenerating any archive, copy it to all its name variants in
  `public/` and to `dist/`, rebuild, then update the checksums on
  `download.html` only if the archive content actually changed.

## 3. Environment variables

### Client / build-time (Vite — set in your host's build env)

| Var                     | Required | Purpose                                   |
| ----------------------- | -------- | ----------------------------------------- |
| `VITE_CONVEX_URL`       | ✅       | Convex backend URL (e.g. `https://<project>.convex.cloud`) |
| `VITE_VLY_APP_ID`       | —        | Freebuff error monitoring project id      |
| `VITE_VLY_MONITORING_URL` | —      | Freebuff error ingestion endpoint         |

### Server / Convex (paste into the project's **Keys / API keys** tab — this
platform manages secrets there; never commit them)

| Var                     | Required | Purpose                                   |
| ----------------------- | -------- | ----------------------------------------- |
| `CONVEX_SITE_URL`       | ✅ (auto)| Auth provider domain; set by Convex automatically |
| `RESEND_API_KEY`        | for email| Transactional email (magic links use the Freebuff OTP relay; story/ticket verdicts use Resend) |
| `STRIPE_SECRET_KEY`     | for billing | Membership checkout (`sk_...`)           |
| `STRIPE_WEBHOOK_SECRET` | for billing | Signature verification for `/stripe-webhook` (`whsec_...`) |
| `SITE_URL`              | —        | Absolute site URL in emails; defaults to `https://starforcebase1198.com` |
| `EMAIL_FROM`            | —        | Sender; defaults to `Star Force 1198 <no-reply@starforcebase1198.com>` (domain must be verified in Resend) |
| `VLY_INTEGRATION_KEY`   | —        | Freebuff AI/payments gateway (auto-injected) |
| `VLY_APP_NAME`          | —        | Label shown in OTP emails                 |
| `GROQ_API_KEY`          | for AI   | Canon Scanner (AI canon-compliance review of story/lore submissions) |
| `CANON_SCANNER_MODEL`   | —        | Scanner model; defaults to `llama-3.3-70b-versatile` |
| `CANON_SCANNER_BASE_URL`| —        | OpenAI-compatible endpoint; defaults to `https://api.groq.com/openai/v1` |
| `SAMBANOVA_API_KEY`     | fallback | Legacy provider fallback (still accepted if present) |

## 4. Hosting options

The app runs **anywhere a static SPA can be served**. All options need the
SPA fallback (serve `index.html` for unknown paths) so client routes like
`/missions/cadet-welcome-tour` resolve.

| Option | Notes |
| ------ | ----- |
| **Freebuff platform (in-repo)** | The Deno `main.ts` (Hono static server) serves `dist/` — the exact bundle shipped in the backup tarball. `build:isolate` keeps `isolate/` as a byte-identical full mirror for the built preview |
| **Vercel** | `bun run build`, output `dist/`, add a rewrite: `{ "source": "/(.*)", "destination": "/index.html" }` |
| **Netlify** | Build `bun run build`, publish `dist/`, add `/* /index.html 200` redirect rule |
| **Cloudflare Pages** | Build `bun run build`, output `dist/`, add a `_redirects` file: `/* /index.html 200` |

**Convex never moves** — it stays on Convex Cloud; only the static frontend
is hosted. For a production Convex deployment: `npx convex deploy`, then set
the server env vars on that deployment in the Convex dashboard.

## 5. One-time service setup

### Stripe (membership)
1. Create a Stripe account → API keys tab → copy `sk_test_...` / `sk_live_...`
   into Convex env as `STRIPE_SECRET_KEY`.
2. Stripe dashboard → **Webhooks** → add endpoint:
   `https://lovely-koala-228.convex.site/stripe-webhook`
   (Convex serves HTTP routes on the `.convex.site` domain — NOT the static
   site domain; a webhook pointed at `starforcebase1198.com` would get the
   SPA instead of Convex.)
   Events: `checkout.session.completed`, `customer.subscription.deleted`.
3. Copy the webhook signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.
4. Test with a checkout from `/membership` (test card `4242 4242 4242 4242`).

### Resend (email)
1. Create a Resend account → add & verify domain `starforcebase1198.com`.
2. Copy `re_...` API key into `RESEND_API_KEY`.
3. `EMAIL_FROM` default already matches the verified domain.

### Seed data (optional, one-time)
Run `seed:seedDemo` with `{"clear": true}` from the Convex dashboard
Functions tab, or `npx convex run seed:seedDemo '{"clear": true}'` — loads
stories, lore, missions (with briefings), groups, forum threads, demo users
and an operator account.

## 6. Post-deploy checklist

- [ ] Sign-up → magic-link email arrives (Freebuff OTP relay works out of the box; Resend key powers story/support verdicts)
- [ ] Membership checkout completes and tier upgrades (webhook granted) + cancellation reverts to Free
- [ ] `/missions`, report-in, and `/operator/reports` review flow works on the live domain
- [ ] `https://starforcebase1198.com/sitemap.xml` and `/robots.txt` resolve
- [ ] System Health shows no new red items (backup provider remains a known placeholder)
- [ ] Error monitoring (`VITE_VLY_APP_ID` / `VITE_VLY_MONITORING_URL`) reporting to Freebuff
