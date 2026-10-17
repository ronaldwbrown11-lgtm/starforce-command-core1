import { describe, expect, test } from "bun:test";
import { CanonWeapon, imageSrcFor, mediaList, safeSrc } from "./ArmoryBrowser";

const DATA_JPG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

function weaponWith(images: unknown): CanonWeapon {
  return {
    _key: "k",
    designation: "SF-P501 'Test'",
    builder: "Aegis",
    images: mediaList(images),
    schematics: [],
  };
}

describe("armory card media", () => {
  test("renders the attached image from the decoded array the API now serves", () => {
    const w = weaponWith([
      { id: "img-1", file_path: DATA_JPG, original_name: "a.jpg" },
    ]);
    expect(imageSrcFor(w)).toBe(DATA_JPG);
  });

  test("decodes an image column served raw as a JSON string", () => {
    const raw = JSON.stringify([
      { id: "img-1", file_path: DATA_JPG, original_name: "a.jpg" },
    ]);
    const list = mediaList(raw);
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("a.jpg");
    expect(imageSrcFor({ ...weaponWith(raw), images: list })).toBe(DATA_JPG);
  });

  test("falls back to the generated tactical plate when nothing is attached", () => {
    const plate = imageSrcFor(weaponWith([]));
    expect(plate.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    expect(decodeURIComponent(plate)).toContain("SF-P501");
  });

  test("accepts a bare http(s) URL string", () => {
    const w = weaponWith("https://cdn.example.com/gun.png");
    expect(imageSrcFor(w)).toBe("https://cdn.example.com/gun.png");
  });

  test("accepts a single attachment object (not wrapped in an array)", () => {
    const w = weaponWith({ file_path: DATA_JPG, original_name: "b.png" });
    expect(imageSrcFor(w)).toBe(DATA_JPG);
  });

  test("never lets non-image schemes reach an img src", () => {
    expect(safeSrc("javascript:alert(1)")).toBeUndefined();
    expect(safeSrc("file:///etc/passwd")).toBeUndefined();
    expect(safeSrc("blob:https://x/abc")).toBe("blob:https://x/abc");
    expect(safeSrc(DATA_JPG)).toBe(DATA_JPG);
  });

  test("a malformed media string falls back to the plate instead of crashing", () => {
    const w = weaponWith("[{not json");
    expect(imageSrcFor(w).startsWith("data:image/svg+xml")).toBe(true);
  });
});