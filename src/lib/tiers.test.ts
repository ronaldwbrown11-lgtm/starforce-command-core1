import { describe, expect, test } from "bun:test";
import {
  TIER_IDS,
  TIERS,
  TIER_ORDER,
  TIER_CAPS_FRONTEND,
  getAiCap,
  getStorageCap,
  getMaxUploadMb,
  tierLabel,
  tierPillVariant,
  tierFlagPill,
  fmtBytes,
  formatPercent,
  parseOverageError,
  type OveragePayload,
  type TierId,
} from "./tiers";

describe("tier catalog", () => {
  test("every tier id has a definition", () => {
    for (const id of TIER_IDS) {
      expect(TIERS[id]).toBeDefined();
      expect(TIERS[id].id).toBe(id);
    }
  });

  test("TIER_ORDER contains exactly the canonical tier ids", () => {
    expect(TIER_ORDER).toEqual([...TIER_IDS]);
  });

  test("pricing labels match the advertised plans", () => {
    expect(TIERS.free.priceLabel).toBe("Free");
    expect(TIERS.cadet.priceLabel).toBe("$5.00");
    expect(TIERS.officer.priceLabel).toBe("$12.00");
    expect(TIERS.command.priceLabel).toBe("$19.00");
    expect(TIERS.elite.priceLabel).toBe("$25.00");
    expect(TIERS.gia_agent.priceLabel).toBe("$49.00");
  });

  test("paid tiers have a monthly cycle, free does not", () => {
    expect(TIERS.free.cycles).toBeNull();
    for (const id of ["cadet", "officer", "command", "gia_agent"] as const) {
      expect(TIERS[id].cycles).toMatch(/month|30d/);
    }
  });
});

describe("tier caps", () => {
  test("frontend caps mirror the canonical tier definitions", () => {
    for (const id of TIER_IDS) {
      // Number() normalizes the literal types so bun's strict expect accepts them.
      expect(Number(TIER_CAPS_FRONTEND[id].aiCap)).toBe(Number(TIERS[id].aiGenerations));
      expect(Number(TIER_CAPS_FRONTEND[id].storageGbCap)).toBe(Number(TIERS[id].storageGb));
      expect(Number(TIER_CAPS_FRONTEND[id].maxUploadMbCap)).toBe(Number(TIERS[id].maxUploadMb));
    }
  });

  test("caps never decrease as tiers escalate", () => {
    for (let i = 1; i < TIER_ORDER.length; i++) {
      const prev = TIER_ORDER[i - 1];
      const curr = TIER_ORDER[i];
      expect(getAiCap(curr)).toBeGreaterThan(getAiCap(prev));
      expect(getStorageCap(curr)).toBeGreaterThan(getStorageCap(prev));
      expect(getMaxUploadMb(curr)).toBeGreaterThan(getMaxUploadMb(prev));
    }
  });

  test("missing tier falls back to the free cap", () => {
    expect(getAiCap(null)).toBe(TIERS.free.aiGenerations);
    expect(getAiCap(undefined)).toBe(TIERS.free.aiGenerations);
    expect(getStorageCap(null)).toBe(TIERS.free.storageGb);
    expect(getMaxUploadMb(undefined)).toBe(TIERS.free.maxUploadMb);
  });

  test("unknown tier id falls back to the free cap", () => {
    expect(getAiCap("admin" as TierId)).toBe(TIERS.free.aiGenerations);
    expect(getStorageCap("admin" as TierId)).toBe(TIERS.free.storageGb);
  });
});

describe("tier labels", () => {
  test("tierLabel returns friendly names", () => {
    expect(tierLabel("free")).toBe("Free Member");
    expect(tierLabel("cadet")).toBe("Cadet");
    expect(tierLabel("gia_agent")).toBe("G.I.A Agent");
  });

  test("tierLabel handles empty and unknown ids", () => {
    expect(tierLabel(null)).toBe("Free Member");
    expect(tierLabel(undefined)).toBe("Free Member");
  });

  test("tierPillVariant maps every tier", () => {
    expect(tierPillVariant("free")).toBe("default");
    expect(tierPillVariant("cadet")).toBe("info");
    expect(tierPillVariant("officer")).toBe("violet");
    expect(tierPillVariant("command")).toBe("violet");
    expect(tierPillVariant("gia_agent")).toBe("gold");
  });

  test("tierFlagPill maps flags", () => {
    expect(tierFlagPill("free")).toEqual({ variant: "default", label: "Free" });
    expect(tierFlagPill("standard")).toEqual({ variant: "info", label: "Active" });
    expect(tierFlagPill("priority")).toEqual({ variant: "violet", label: "Priority" });
    expect(tierFlagPill("top")).toEqual({ variant: "gold", label: "Top placement" });
  });
});

describe("formatters", () => {
  test("fmtBytes scales units", () => {
    expect(fmtBytes(512)).toBe("512 B");
    expect(fmtBytes(2048)).toBe("2.0 KB");
    expect(fmtBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(fmtBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.50 GB");
  });

  test("formatPercent clamps to 0..999 and guards zero caps", () => {
    expect(formatPercent(0, 100)).toBe(0);
    expect(formatPercent(50, 100)).toBe(50);
    expect(formatPercent(150, 100)).toBe(150);
    expect(formatPercent(5000, 10)).toBe(999);
    expect(formatPercent(10, 0)).toBe(0);
    expect(formatPercent(10, -1)).toBe(0);
  });
});

describe("parseOverageError", () => {
  const payload: OveragePayload = {
    code: "ultraforce_overage_requires_confirm",
    kind: "ai",
    current: 10,
    projected: 11,
    cap: 10,
    tier: "free",
  };

  test("parses a valid overage payload", () => {
    expect(parseOverageError(JSON.stringify(payload))).toEqual(payload);
  });

  test("returns null for non-JSON messages", () => {
    expect(parseOverageError("Overage limit reached")).toBeNull();
  });

  test("returns null when the code does not match", () => {
    expect(parseOverageError(JSON.stringify({ code: "something_else" }))).toBeNull();
  });
});
