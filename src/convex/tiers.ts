/**
 * Shared backend tier caps.
 * MUST stay in sync with `src/lib/tiers.ts`.
 * Operators have effectively no cap (Infinity) when consuming in operator role,
 * but each consumption is still recorded for auditability.
 */

import type { TierId } from "./schema";


const META: Record<
  TierId,
  { aiCap: number; storageGbCap: number; maxUploadMbCap: number }
> = {
  free: { aiCap: 10, storageGbCap: 0.5, maxUploadMbCap: 5 },
  cadet: { aiCap: 100, storageGbCap: 5, maxUploadMbCap: 50 },
  officer: { aiCap: 300, storageGbCap: 15, maxUploadMbCap: 100 },
  command: { aiCap: 750, storageGbCap: 40, maxUploadMbCap: 200 },
  gia_agent: { aiCap: 2000, storageGbCap: 100, maxUploadMbCap: 500 },
};

export function getAiCapForTier(tier: TierId | null | undefined): number {
  if (!tier) return META.free.aiCap;
  return META[tier]?.aiCap ?? META.free.aiCap;
}

export function getStorageCapForTier(tier: TierId | null | undefined): number {
  if (!tier) return META.free.storageGbCap;
  return META[tier]?.storageGbCap ?? META.free.storageGbCap;
}

export function getMaxUploadMbForTier(tier: TierId | null | undefined): number {
  if (!tier) return META.free.maxUploadMbCap;
  return META[tier]?.maxUploadMbCap ?? META.free.maxUploadMbCap;
}
