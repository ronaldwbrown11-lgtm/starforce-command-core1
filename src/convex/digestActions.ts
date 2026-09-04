import { action } from "./_generated/server";
import { internal } from "./_generated/api";

// =========================================================================
// Weekly digest — public operator action surface.
//
// Mirrors the discordBridgeActions pattern: authorization runs first in a
// gated internalQuery (digestData.requireDigestOperator), then the send
// executes in the Node.js runtime (digest.sendWeeklyDigest). Synchronous —
// the caller gets the batch result. The cron (cronJobs.ts) keeps running
// every Monday regardless; this is the manual "prove it works / send early"
// path for operators.
// =========================================================================

export const sendDigestNow = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ ok: boolean; sent?: number; failed?: number; reason?: string }> => {
    await ctx.runQuery(internal.digestData.requireDigestOperator, {});
    const res = (await ctx.runAction(internal.digest.sendWeeklyDigest, {})) as {
      ok?: boolean;
      sent?: number;
      failed?: number;
      reason?: string;
    };
    return {
      ok: res.ok === true,
      sent: typeof res.sent === "number" ? res.sent : 0,
      failed: typeof res.failed === "number" ? res.failed : 0,
      reason: typeof res.reason === "string" ? res.reason : undefined,
    };
  },
});