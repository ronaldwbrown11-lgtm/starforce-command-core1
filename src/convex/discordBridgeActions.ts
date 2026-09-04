import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// =========================================================================
// Discord presence bridge — public operator action surface.
//
// Lives in its own module and annotates its results explicitly: on this
// Convex version, an action whose handler returns the raw result of
// internal.discordBridge.* references triggers a TypeScript inference cycle
// that degrades the export to `any`. Authorization runs first in
// requireBridgeOperator (a gated internalQuery in discordBridge.ts), then
// the POST executes in the Node.js runtime
// (discordBridgeNode.sendTestTransmission). Synchronous — the caller gets
// the webhook's actual response.
// =========================================================================

export const testBridgeConnection = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ posted: boolean; reason?: string }> => {
    const gate = (await ctx.runQuery(
      internal.discordBridge.requireBridgeOperator,
      {},
    )) as { me: Id<"users"> };
    const res = (await ctx.runAction(
      internal.discordBridgeNode.sendTestTransmission,
      { actorId: gate.me },
    )) as { posted?: boolean; reason?: string };
    return {
      posted: res.posted === true,
      reason: typeof res.reason === "string" ? res.reason : undefined,
    };
  },
});
