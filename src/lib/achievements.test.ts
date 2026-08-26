import { describe, expect, test } from "bun:test";
import { ACHIEVEMENT_CATALOG, getAchievement } from "./achievements";

describe("achievement catalog", () => {
  test("exposes the core achievements", () => {
    expect(ACHIEVEMENT_CATALOG["first_story"]).toBeDefined();
    expect(ACHIEVEMENT_CATALOG["lore_contributor"]).toBeDefined();
    expect(ACHIEVEMENT_CATALOG["crew_chief"]).toBeDefined();
    expect(ACHIEVEMENT_CATALOG["centurion"]).toBeDefined();
    expect(ACHIEVEMENT_CATALOG["pioneer"]).toBeDefined();
  });

  test("every entry has a label, description, tone, and icon", () => {
    for (const entry of Object.values(ACHIEVEMENT_CATALOG)) {
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
      expect(typeof entry.description).toBe("string");
      expect(["cyan", "violet", "gold", "green"]).toContain(entry.tone);
      expect(entry.icon).toBeDefined();
    }
  });

  test("getAchievement returns the entry for a known id", () => {
    const entry = getAchievement("first_flight");
    expect(entry?.label).toBe("First Flight");
  });

  test("getAchievement returns undefined for an unknown id", () => {
    expect(getAchievement("no_such_achievement")).toBeUndefined();
  });
});
