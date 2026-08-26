# Auto-Deploy Setup — GitHub → Hostinger

## What you'll get
- Push code to GitHub → site auto-builds and deploys in ~90 seconds
- No more manual download/upload cycles
- Every change I make deploys with one command from my side

## One-time setup (5 minutes)

### Step 1: Get your Hostinger FTP credentials

1. Log into **hPanel** (hostinger.com → Hosting → Manage)
2. Go to **FTP Accounts** (under Accounts or Files section)
3. Note these three values:
   - **FTP Host** — usually `starforcebase1198.com` or an IP address
   - **FTP Username** — e.g. `u102692168_steven`
   - **FTP Password** — the one you set (or click "Change Password" to set a new one)

> If you don't see FTP Accounts, go to **Files → File Manager** and look for **FTP Access** in the sidebar.

### Step 2: Create a GitHub repo

1. Go to **github.com** → click **+** → **New repository**
2. Name it `starforce-base-1198` (or anything you like)
3. Set it to **Private** (your source code shouldn't be public)
4. Click **Create repository**
5. Copy the repo URL (it'll look like `https://github.com/YOURNAME/starforce-base-1198.git`)

### Step 3: Add the secrets

1. Go to your new repo → **Settings** (tab) → **Secrets and variables** → **Actions**
2. Click **New repository secret** three times and add:

| Name | Value |
|------|-------|
| `FTP_HOST` | Your FTP hostname (from Step 1) |
| `FTP_USERNAME` | Your FTP username (from Step 1) |
| `FTP_PASSWORD` | Your FTP password (from Step 1) |

### Step 4: Push the source code

On my end, I'll push the code once you give me the repo URL. Or you can do it:

```bash
# If you have the source code locally:
git init
git remote add origin https://github.com/YOURNAME/starforce-base-1198.git
git add -A
git commit -m "Initial push"
git branch -M main
git push -u origin main
```

### Step 5: That's it!

Once the code is pushed, GitHub Actions will:
1. Install dependencies
2. Build the project
3. Upload `dist/` to your Hostinger `public_html/` via FTP

You can watch it run in your repo → **Actions** tab.

## How it works going forward

Every time I make changes:
1. I build and commit to `main`
2. GitHub Actions auto-deploys (~90 seconds)
3. Your site updates — no download, no upload, no manual steps

**You can also deploy manually** by going to your repo → Actions tab → "Deploy to Hostinger" → Run workflow.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Deploy fails with "FTP connection refused" | Check FTP credentials in Settings → Secrets. Try reconnecting in hPanel → FTP Accounts. |
| Site shows old version after deploy | Hard refresh (Ctrl/Cmd+Shift+R). The `.htaccess` SPA fallback should handle routing. |
| Build fails | Check the Actions log. Usually a missing env variable — add `VITE_CONVEX_URL` as a repo Variable (not Secret) in Settings → Secrets and variables → Actions → Variables tab. |
| I want to preview before deploy | GitHub Actions creates a log of every deploy. You can also set up a second branch (e.g. `staging`) that deploys to a subdomain. |

## Your Convex URL (for the Variables tab)

```
VITE_CONVEX_URL = https://lovely-koala-228.convex.cloud
```

Add this in your repo → Settings → Secrets and variables → Actions → **Variables** tab → New repository variable.
