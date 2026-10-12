import type { GenericDatabaseReader } from "convex/server";
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { DataModel, Id } from "./_generated/dataModel";

/**
 * Sealed storage ids — the content the base does NOT give away.
 *
 *   • lore bibles are SOLD in the Requisition Depot: a buyer gets the file
 *     from store.getFileDownloadUrl, which checks storeEntitlements.
 *   • lore databases are closed to downloads; they are read on-page only.
 *   • digital store products are buyer-only.
 *   • vault payloads are holders-only.
 *
 * Cover images and gallery plates are deliberately NOT sealed — they are the
 * site's display art and are rendered on public pages anyway.
 *
 * This matters at the two places that turn a bare storage id into bytes:
 * the public /lab-image/ HTTP route (http.ts) and the assets.coverUrl
 * resolver. Without this check, a storage id that leaked into a page payload
 * or a shared URL would become a free download of sold content.
 *
 * Takes the raw database reader so both query ctx and httpAction ctx fit.
 */
export async function isSealedStorageId(
  db: GenericDatabaseReader<DataModel>,
  storageId: Id<"_storage">,
): Promise<boolean> {
  const lore = await db
    .query("loreLibrary")
    .withIndex("by_fileStorageId", (q) => q.eq("fileStorageId", storageId))
    .first();
  if (lore && (lore.loreType === "bible" || lore.loreType === "database")) {
    return true;
  }

  const product = await db
    .query("storeProducts")
    .withIndex("by_fileStorageId", (q) => q.eq("fileStorageId", storageId))
    .first();
  if (product) return true;

  const vault = await db
    .query("vaultItems")
    .withIndex("by_fileStorageId", (q) => q.eq("fileStorageId", storageId))
    .first();
  return vault !== null;
}

/**
 * Same check for HTTP actions (http.ts), which reach the database through
 * runQuery rather than a direct ctx.db.
 */
export const isSealedStorageIdQuery = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => await isSealedStorageId(ctx.db, args.storageId),
});
