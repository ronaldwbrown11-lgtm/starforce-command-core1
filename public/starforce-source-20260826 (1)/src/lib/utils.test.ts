import { describe, expect, test } from "bun:test";
import { cn } from "./utils";

describe("cn", () => {
  test("joins truthy classes with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  test("filters falsy values", () => {
    expect(cn("a", false, undefined, null, 0, "b")).toBe("a b");
  });

  test("flattens arrays and objects", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });

  test("merges conflicting tailwind classes (last wins)", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    // p-4 keeps its x-axis padding; py-2 overrides only the vertical axis.
    expect(cn("p-4", "py-2")).toBe("p-4 py-2");
  });

  test("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
