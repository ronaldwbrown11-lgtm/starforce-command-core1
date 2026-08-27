# Lore Database Integration — Runbook

The proven pattern for wiring a canon lore database (a standalone subdomain
app on Hostinger) into the Star Force 1198 site. **Personnel** and
**Armory** are done this way; **Sector Atlas** and **Fleet Registry** are
the next two to build with the exact same playbook.

---

## The pattern (one page of truth)

```
Browser widget (React, direct fetch, NO Convex)
        │  GET / read
        ▼
Subdomain PHP read API (weapons.php style)  ──►  Hostinger MySQL table
        ▲
        │  POST / PUT / DELETE (weapons-sync.php style)
Standalone app on the subdomain (index.html) — writes go to MySQL,
localStorage kept only as offline fallback
```

### 1. Hostinger subdomain — three files, one folder

All three live in the subdomain's web root (File Manager →
`public_html/<subdomain>/`).

| File | Role | Non-negotiables |
| --- | --- | --- |
| `weapons.php` (rename per DB) | Read API | JSON `{success, records:[...]}`; `header("Access-Control-Allow-Origin: *");` after `<?php`; version marker (e.g. `"file":"weapons-read-v2"`) in every response so we can verify which copy is live |
| `weapons-sync.php` | Write API (POST/PUT/DELETE) | CORS + preflight OPTIONS; **no shared-key check** (see lessons); prepared statements + validation; `"file":"weapons-sync-v4"` marker in every response |
| `index.html` | The app | Saves/edits/deletes call the write API; on load **merge server records + push any local-only records up** (this is how orphaned localStorage records recover); localStorage stays as offline fallback |

### 2. Hostinger DB credentials

Hostinger pattern — **username and database name are different things:**

```php
$DB_HOST = "localhost";
$DB_NAME = "u102692168_Star_Force";   // the DATABASE (matches phpMyAdmin URL)
$DB_USER = "u102692168_Seven";        // the USER — ask the owner, don't assume
$DB_PASS = "<owner fills in — never guess>";
```

The owner must fill `$DB_PASS` themselves; bake everything else in so they
don't have to edit more than one line.

### 3. Site side (this repo)

- Widget component in `src/components/widgets/` (e.g. `ArmoryBrowser.tsx`)
  — fetches the subdomain read API **directly from the browser**, with
  loading / error / retry states and no external links.
- Helper export `isXArchive(item)` matching on title/databaseName/databaseUrl
  (see `isPersonnelArchive` / `isArmoryArchive`).
- Lore → Databases tab (`src/pages/Lore.tsx` → `DatabasePanel`) renders a
  **card grid**; every card links to `/lore/databases/:slug`.
- Dedicated page `src/pages/LoreDatabase.tsx` renders the widget for known
  types (personnel / armory), else embeds the subdomain URL in an iframe or
  shows a "deploying" state.
- Route in `src/main.tsx`: `<Route path="/lore/databases/:slug" element={<LoreDatabase />} />`.

### 4. Verification loop (always run it)

```bash
# read API healthy + which file is live (marker)
curl -sS "https://<sub>.starforcebase1198.com/<read>.php"

# write → read back → delete (full loop)
curl -sS -X POST -H "Content-Type: application/json" \
  -d '{"id":"E2E-PROOF-001","designation":"Proof"}' \
  "https://<sub>.starforcebase1198.com/weapons-sync.php"
curl -sS "https://<sub>.starforcebase1198.com/<read>.php"   # expect 1 more record
curl -sS -X DELETE "https://<sub>.starforcebase1198.com/weapons-sync.php?id=E2E-PROOF-001"
```

### 5. Ship the site change

Any bundle change → rebuild `dist/`, rebuild `backup-hostinger-dist.zip`
from `dist/` (explicit file list: `index.html logo.svg manifest.webmanifest
robots.txt sitemap.xml .htaccess` + `assets/` tree), update the SHA-256 on
`public/download.html`, copy the zip to `public/`, `bun run build` once more
so the built download page matches, verify checksums in `dist/`.

---

## Current deployment state

| Database | Subdomain | Read API | Write API | App | Site widget | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Personnel (Service Record Manager) | `personnel.` | `api/records.php` | n/a (app-owned) | existing | `PersonnelDossierBrowser.tsx` | ✅ done, live |
| Armory | `armory.` | `weapons.php` (marker `weapons-read-v2`) | `weapons-sync.php` (marker `weapons-sync-v4`) | `index.html` (sync-enabled) | `ArmoryBrowser.tsx` | ✅ done, live |
| Sector Atlas | — n/a (built into site) | Convex `sectorMap` table | Convex mutations (operator console) | `/map` + `/maps` pages | `DiscoveryMap.tsx` | ✅ done, built-in |
| Fleet Registry | `fleetregistry.` | `api.php` (vehicle read API) | app-owned (`/api/auth/login` console) | React app on subdomain (`/registry`) | iframe on `/fleet-registry` | ✅ done, live |

Hostinger MySQL: DB `u102692168_Star_Force`, user `u102692168_Seven`
(armory `weapons` table already holds the 23 canon weapons; the fleet
registry app stores its vehicle records in the same DB — `vehicles` table,
operator logins in `nighthawk_operators`).

Current site build zip: SHA-256 `938d6866…` (after the lore-databases-own-pages
change). Armory wiring zip: `7ebebbbb…` (contains `weapons.php`,
`weapons-sync.php`, `index.html` under their real upload names).

---

## Lessons learned (the ones that cost real time)

1. **DB username ≠ DB name on Hostinger.** `u102692168_Star_Force` is the
   database; the user is `u102692168_Seven`. Ask for the username, bake it in.
2. **Never rely on the owner hand-editing server PHP.** Files "had the
   changes" on their end while the server kept serving old logic. Fixes:
   bake everything we know into the file and use **version markers** in every
   response (`"file":"weapons-sync-v4"`) — one curl tells us which file is
   actually live. If the marker doesn't appear, the upload didn't stick.
3. **The shared-key check was the #1 source of failure.** The key lived in a
   public HTML file anyway (zero real security), and alignment failed
   repeatedly (header stripped by CDN, guard variable moved, key edited on
   server). **v4 removed the key entirely** — the API is a public
   canon-database writer protected by validation + prepared statements. Do
   not reintroduce a key without a real auth system.
4. **The app's original "save" was fake.** `POST /api/records` lines in its
   activity log were cosmetic; everything went to localStorage
   (`sf_relational_weapons_db_v3`). Wiring = real `fetch` calls + a
   load-time merge that pushes localStorage-only records up.
5. **Filenames must match exactly on the server.** A file uploaded as
   `armory-weapons-sync.php` served fine but 404'd as `weapons-sync.php`.
   Ship files in a zip under their real upload names.
6. **CORS is per-PHP-file.** Every API file needs
   `header("Access-Control-Allow-Origin: *");` — adding it to one file
   doesn't cover another, and a bad edit to it can 500 the whole file.
7. **A broken read API looks like "the data is gone."** `weapons.php`
   returning 500 "Database connection failed" after a re-upload is almost
   always stale `CHANGE_ME` credentials in the newly uploaded copy — check
   `$DB_PASS`/`$DB_USER` before touching anything else.
8. **Verify from here after every user upload.** curl the endpoints and run
   the E2E write/read/delete loop rather than trusting "it's in place."

---

## Next integrations (Sector Atlas, Fleet Registry)

When the owner builds the Atlas / Fleet apps on their subdomains, follow the
Armory path exactly:

1. Pull the app's data structure (fields) — extract like the 23 weapons were
   extracted from the armory app.
2. Build the read PHP + write PHP (markers included, keyless) for that
   subdomain; give the owner one zip with real upload names + DB creds
   (username `u102692168_Seven` style — ask) + the password line to fill.
3. Add a browser widget (`AtlasBrowser.tsx` / `FleetBrowser.tsx`) with
   `isAtlasArchive` / `isFleetRegistry` helpers; wire into `LoreDatabase.tsx`
   and the `DatabasePanel` card grid (no changes needed to the grid — it's
   generic).
4. Run the E2E loop, rebuild the site zip, update the checksum.
