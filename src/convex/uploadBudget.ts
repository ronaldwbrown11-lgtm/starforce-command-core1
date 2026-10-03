import { TIERS, type TierId } from "../lib/tiers";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/**
 * Membership-tier upload gate for Convex-storage uploads (visual assets and
 * lab images), mirroring the R2 member-file rules in storage.ts:
 *
 *   1. Per-file cap  — TIERS[tier].maxUploadMb (free 5 MB, cadet 50 MB, …).
 *   2. Storage quota — TIERS[tier].storageGb, summed from raw rows (your R2
 *      memberFiles + your visualAssets) so deleting a file frees quota
 *      automatically — no counter that can drift.
 *
 * Bypass: users.unlimitedUsage (owner-level) and operators (opRole /
 * role admin), matching the operator override in usage.consumeStorage.
 *
 * Known limitation: lab images are stored without an uploader field (they
 * are referenced by dossier rows as plain URLs), so they are subject to the
 * per-file cap but cannot be attributed for the cumulative quota.
 */
export async function enforceUploadBudget(
  ctx: MutationCtx,
  userId: Id<"users">,
  fileSize: number,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("Sign in required.");
  if (user.unlimitedUsage === true || user.opRole || user.role === "admin") {
    return;
  }

  const tierId = (
    TIERS[(user.tier ?? "free") as TierId] ? (user.tier ?? "free") : "free"
  ) as TierId;
  const def = TIERS[tierId];

  // 1) Per-file cap.
  const maxFileBytes = def.maxUploadMb * 1024 * 1024;
  if (fileSize > maxFileBytes) {
    throw new Error(
      `File too large. Your ${def.name} tier allows max ${def.maxUploadMb} MB per file.`,
    );
  }

  // 2) Cumulative storage quota (raw sums — same model as storage.ts).
  const memberFiles = await ctx.db
    .query("memberFiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  let used = memberFiles.reduce((sum, f) => sum + f.fileSize, 0);
  const assets = await ctx.db
    .query("visualAssets")
    .withIndex("by_author", (q) => q.eq("authorId", userId))
    .collect();
  used += assets.reduce((sum, a) => sum + a.byteSize, 0);

  const quotaBytes = def.storageGb * 1024 * 1024 * 1024;
  if (used + fileSize > quotaBytes) {
    throw new Error(
      `Storage quota exceeded. You've used ${formatBytes(used)} of ${formatBytes(quotaBytes)} on your ${def.name} tier. Delete some files or upgrade your tier.`,
    );
  }
}
