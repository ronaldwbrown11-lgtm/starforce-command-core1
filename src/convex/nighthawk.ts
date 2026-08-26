"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

async function requireOperator(ctx: any) {
  const id = await getAuthUserId(ctx);
  if (!id) throw new Error("Sign in required.");
  const user = await ctx.runQuery(api.users.currentUser).catch(() => null);
  if (!user || (user.role !== "admin" && !user.opRole)) throw new Error("Forbidden.");
  return id;
}

async function callNighthawk(path: string, init?: RequestInit) {
  const base = process.env.NIGHTHAWK_API_URL;
  const secret = process.env.NIGHTHAWK_BRIDGE_SECRET;
  if (!base || !secret) throw new Error("Nighthawk bridge is not configured.");
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Operator-Key": secret,
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `Nighthawk request failed (${response.status}).`);
  return body;
}

export const pendingVehicles = action({
  args: {},
  handler: async (ctx) => {
    await requireOperator(ctx);
    return await callNighthawk("?action=pending");
  },
});

export const reviewVehicle = action({
  args: {
    id: v.number(),
    reviewStatus: v.union(v.literal("approved"), v.literal("rejected"), v.literal("changes_requested")),
  },
  handler: async (ctx, args) => {
    const operatorId = await requireOperator(ctx);
    const result = await callNighthawk("?action=review", {
      method: "PUT",
      body: JSON.stringify({ id: args.id, review_status: args.reviewStatus }),
    });
    await ctx.runMutation(api.operator.recordExternalAudit, {
      actorId: operatorId,
      action: `vehicle.${args.reviewStatus}`,
      target: `nighthawk_vehicle:${args.id}`,
    }).catch(() => undefined);
    return result;
  },
});
