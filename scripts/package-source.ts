#!/usr/bin/env bun
/**
 * Star Force Base 1198 — source package builder
 * ----------------------------------------------
 * Regenerates `public/starforce-source-latest.tar.gz` from the CURRENT tree
 * every time it runs, so `ship to site.bat` (which downloads that exact file)
 * can never ship stale code.
 *
 * The archive:
 *   - is stamped with BUILD-INFO.txt (build time, git commit if available,
 *     file count, SHA-256) so a shipped site can always be identified;
 *   - never contains secrets (.env*), never the archive itself, never
 *     node_modules / dist / isolate / backups / .git;
 *   - always contains the app-critical public files (.htaccess, sw.js,
 *     manifest.webmanifest, logo.svg, index.html config).
 *
 * Runs automatically after `bun run build` and `bun run build:ci` (see
 * package.json), and can be run standalone: `bun run package:source`.
 *
 * On success it prints the SHA-256 and a one-line stamp summary. It exits
 * non-zero (so CI and the build pipeline fail loudly) if the archive cannot
 * be created or fails self-verification.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "public", "starforce-source-latest.tar.gz");
const STAMP = join(ROOT, "BUILD-INFO.txt");
const EXCLUDE_FILE = join(ROOT, "sf-excludes.txt");

// ---------------------------------------------------------------------------
// Exclusions
// ---------------------------------------------------------------------------

/** Always excluded from the archive — secrets and machinery. */
const HARD_EXCLUDE_PARTS = new Set([
  "node_modules",
  "dist",
  "isolate",
  ".git", // the repo itself — note: .github (workflows) MUST ship
  "backups",
  "bun.lockb", // binary lockfile variant, if present
  ".DS_Store",
  "Thumbs.db",
  "BUILD-INFO.txt", // regenerated, never packed
]);

/** Basenames that must never leak (secrets). */
const SECRET_BASENAMES = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
];

/** Read the operator-maintained exclude list (one path-or-pattern per line). */
function readSfExcludes(): string[] {
  if (!existsSync(EXCLUDE_FILE)) return [];
  return readFileSync(EXCLUDE_FILE, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"))
    .filter((l) => !l.startsWith("!")); // negations are for tar; we include by default
}

// ---------------------------------------------------------------------------
// File walk
// ---------------------------------------------------------------------------

type WalkResult = { files: string[]; skipped: number };

function walk(dir: string, excludes: string[]): WalkResult {
  const files: string[] = [];
  let skipped = 0;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return { files: [], skipped: 1 };
  }
  for (const name of entries) {
    const abs = join(dir, name);
    const rel = relative(ROOT, abs).split(sep).join("/"); // posix-style for tar
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(abs);
    } catch {
      skipped++;
      continue;
    }
    if (st.isSymbolicLink()) {
      skipped++;
      continue;
    }
    if (HARD_EXCLUDE_PARTS.has(name)) {
      skipped++;
      continue;
    }
    if (SECRET_BASENAMES.includes(name)) {
      skipped++;
      continue;
    }
    // .env.example is a safe, keyless template — never treat it as a secret
    // even though the .env.* glob in sf-excludes.txt would match it.
    const isEnvExample = rel === ".env.example" || rel.endsWith("/.env.example");
    if (!isEnvExample && excludes.some((pat) => matchExclude(rel, pat))) {
      skipped++;
      continue;
    }
    if (st.isDirectory()) {
      const sub = walk(abs, excludes);
      files.push(...sub.files);
      skipped += sub.skipped;
    } else if (st.isFile()) {
      files.push(rel);
    } else {
      skipped++;
    }
  }
  return { files, skipped };
}

/**
 * Exclude matcher for sf-excludes.txt patterns:
 *   - a bare path segment ("dist") excludes any path containing that segment
 *   - "public/foo.php" excludes that exact path
 *   - "*.tar.gz" excludes any path matching the glob
 */
function matchExclude(rel: string, pat: string): boolean {
  if (pat.includes("*")) {
    // Convert a simple glob to a regex: * → anything, ? → one char.
    const rx = new RegExp(
      "^" +
        pat
          .split("*")
          .map((s) => s.replace(/[.+^${}()|[\]\\]/g, "\\$&"))
          .join(".*")
          .split("?")
          .map((s) => s)
          .join(".") +
        "$",
    );
    if (rx.test(rel)) return true;
    // Also allow matching against the basename, so a pattern like
    // "*.tar.gz" catches an archive sitting at the project root, and
    // "public/*.tar.gz" still matches only inside public/.
    const base = rel.split("/").pop() ?? rel;
    if (rx.test(base)) {
      // Root-level glob (no directory part in the pattern) applies anywhere.
      if (!pat.includes("/")) return true;
      // Otherwise the glob's directory prefix must match the file's dir.
      const dir = rel.slice(0, rel.length - base.length - 1);
      return pat.slice(0, pat.indexOf("/")) === dir || dir === "";
    }
    return false;
  }
  if (pat.includes("/")) {
    // Exact path (also match a directory prefix).
    return rel === pat || rel.startsWith(pat + "/");
  }
  // Bare segment: exclude any path that has this segment.
  return rel.split("/").includes(pat);
}

// ---------------------------------------------------------------------------
// Build info stamp
// ---------------------------------------------------------------------------

function gitCommit(): string {
  try {
    const r = spawnSync("git", ["rev-parse", "HEAD"], { cwd: ROOT });
    if (r.status === 0) {
      return r.stdout.toString().trim().slice(0, 12);
    }
  } catch {
    /* git unavailable — fine */
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  if (!existsSync(join(ROOT, "package.json"))) {
    console.error("[package-source] Not run from the project root.");
    return 1;
  }
  if (!existsSync(join(ROOT, "sf-excludes.txt"))) {
    console.error(
      "[package-source] sf-excludes.txt is missing — refusing to guess the exclude list.",
    );
    return 1;
  }

  console.log("[package-source] Scanning source tree…");
  const excludes = readSfExcludes();
  const { files, skipped } = walk(ROOT, excludes);
  if (files.length < 50) {
    console.error(
      `[package-source] Only ${files.length} files collected — something is wrong with the walk. Aborting.`,
    );
    return 1;
  }

  // --- sanity: required files present -------------------------------------
  const required = [
    "package.json",
    "index.html",
    "src/main.tsx",
    "src/convex/schema.ts",
    "public/.htaccess",
    "public/sw.js",
    "public/manifest.webmanifest",
    "public/logo.svg",
    ".github/workflows/deploy.yml", // without it, a push deploys nothing
    ".github/workflows/deploy-staging.yml",
  ];
  const missing = required.filter((f) => !files.includes(f));
  if (missing.length > 0) {
    console.error(
      "[package-source] Required files missing from the package — refusing to build it:",
    );
    for (const m of missing) console.error("  - " + m);
    console.error(
      "(If these were removed intentionally, update REQUIRED in scripts/package-source.ts.)",
    );
    return 1;
  }

  // --- sanity: no secrets ---------------------------------------------------
  const leaked = files.filter((f) =>
    SECRET_BASENAMES.some((s) => f === s || f.endsWith("/" + s)),
  );
  if (leaked.length > 0) {
    console.error(
      "[package-source] Secret files would be packed — aborting:",
      leaked.join(", "),
    );
    return 1;
  }

  // --- stamp ---------------------------------------------------------------
  const builtAt = new Date().toISOString();
  writeFileSync(
    STAMP,
    [
      "Star Force Base 1198 — build stamp",
      `Built: ${builtAt}`,
      `Commit: ${gitCommit()}`,
      `Files (excluding this stamp): ${files.length}`,
      "This file is generated by scripts/package-source.ts; do not edit.",
      "",
    ].join("\n"),
  );
  files.push("BUILD-INFO.txt");

  // --- build the tarball deterministically ----------------------------------
  // Sort in JS so member order is identical regardless of tar flavor
  // (GNU tar --sort=name is not available on Windows' bsdtar).
  files.sort();

  mkdirSync(join(ROOT, "public"), { recursive: true });
  const tmp = OUT + ".tmp";
  rmSync(tmp, { force: true });
  // Owner/group normalization only applies when the tar supports GNU flags
  // (Linux CI / Git Bash). Windows ships bsdtar, which rejects them — there
  // we fall back to the portable arg set (order still deterministic via the
  // JS sort above; uid/gid differences do not affect file contents).
  const isGnuTar = detectGnuTar();
  const baseArgs = ["-czf", tmp, "--"];
  const gnuArgs = ["--sort=name", "--owner=0", "--group=0", "--numeric-owner"];
  const runTar = (flavorArgs: string[]) =>
    spawnSync("tar", [...baseArgs, ...flavorArgs, ...files], { cwd: ROOT });
  let tar = isGnuTar ? runTar(gnuArgs) : runTar([]);
  if (tar.status !== 0 && isGnuTar) {
    // GNU flags unexpectedly failed — retry portable before giving up.
    rmSync(tmp, { force: true });
    tar = runTar([]);
  }
  if (tar.status !== 0) {
    console.error(
      "[package-source] tar failed:",
      tar.stderr?.toString() || tar.error?.message || "unknown error",
    );
    rmSync(tmp, { force: true });
    return 1;
  }

  // --- verify ---------------------------------------------------------------
  const list = spawnSync("tar", ["-tzf", tmp], { cwd: ROOT });
  if (list.status !== 0) {
    console.error("[package-source] Archive verification read failed.");
    rmSync(tmp, { force: true });
    return 1;
  }
  const listed = new Set(
    list.stdout
      .toString()
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0 && !l.endsWith("/")),
  );
  const expected = new Set(files);
  const notListed = [...expected].filter((f) => !listed.has(f));
  const extra = [...listed].filter((f) => !expected.has(f));
  if (notListed.length > 0 || extra.length > 0) {
    console.error(
      `[package-source] Archive mismatch — ${notListed.length} missing, ${extra.length} extra. Aborting.`,
    );
    if (notListed.length > 0)
      console.error("  missing:", notListed.slice(0, 10).join(", "));
    if (extra.length > 0) console.error("  extra:", extra.slice(0, 10).join(", "));
    rmSync(tmp, { force: true });
    return 1;
  }

  rmSync(OUT, { force: true });
  renameSyncSafe(tmp, OUT);

  const sha = createHash("sha256").update(readFileSync(OUT)).digest("hex");

  // --- freshness sidecar ---------------------------------------------------
  // The .bat downloads this tiny file next to the archive and refuses to
  // extract unless the hashes match — so a stale CDN/proxy copy can never
  // reach the local checkout.
  const SIDECAR = OUT + ".sha256";
  const sidecarBody = `${sha}  starforce-source-latest.tar.gz\n`;
  writeFileSync(SIDECAR, sidecarBody);

  // --- mirror into dist/ and isolate/ ---------------------------------------
  // The sandbox server (main.ts) serves dist/, and that is exactly where
  // "ship to site.bat" downloads the package from — so the FRESH archive and
  // its sidecar must both live there. (Stale copies that Vite copied from
  // public/ get overwritten by this sync. Hostinger never receives them
  // because deploy.yml's FTP mirror excludes *.tar.gz / *.zip / *.tgz.)
  for (const dir of ["dist", "isolate"]) {
    const absDir = join(ROOT, dir);
    if (!existsSync(absDir)) continue;
    try {
      copyFileSync(OUT, join(absDir, "starforce-source-latest.tar.gz"));
      writeFileSync(join(absDir, "starforce-source-latest.tar.gz.sha256"), sidecarBody);
    } catch {
      /* non-fatal */
    }
  }

  const sizeMb = (statSync(OUT).size / (1024 * 1024)).toFixed(1);
  console.log(
    `[package-source] Packaged ${files.length} files (${skipped} excluded) → public/starforce-source-latest.tar.gz (${sizeMb} MB)`,
  );
  console.log(`[package-source] Build: ${builtAt} @ ${gitCommit()}`);
  console.log(`[package-source] SHA-256: ${sha}`);
  console.log(`[package-source] Sidecar: public/starforce-source-latest.tar.gz.sha256`);
  return 0;
}

/** True when the on-path tar is GNU tar (supports --sort / --numeric-owner). */
function detectGnuTar(): boolean {
  try {
    const r = spawnSync("tar", ["--version"]);
    if (r.status === 0) {
      return r.stdout.toString().includes("GNU tar");
    }
  } catch {
    /* fall through */
  }
  return false;
}

/** Replace the target atomically, tolerating a transient Windows file lock. */
function renameSyncSafe(from: string, to: string): void {
  rmSync(to, { force: true });
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      renameSync(from, to);
      return;
    } catch (err) {
      if (attempt === 5) throw err;
      // EBUSY/EPERM on Windows usually clears within milliseconds.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 120);
    }
  }
}

process.exit(main());
