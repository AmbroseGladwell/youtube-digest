import { describe, expect, it } from "vitest";
import { APPEARANCE_STORAGE_KEY, DEFAULT_APPEARANCE, readAppearance, writeAppearance } from "./appearanceStorage.js";

const memoryStorage = (entries: Record<string, string> = {}) =>
  ({
    getItem: (key: string) => entries[key] ?? null,
    setItem: (key: string, value: string) => {
      entries[key] = value;
    },
  }) as unknown as Storage;

describe("the device's copy of the appearance", () => {
  it("reads back what was written", () => {
    const storage = memoryStorage();
    writeAppearance({ theme: "dark", accentColour: "teal" }, storage);

    expect(readAppearance(storage)).toEqual({ theme: "dark", accentColour: "teal" });
  });

  it("is the default when nothing has been written", () => {
    expect(readAppearance(memoryStorage())).toEqual(DEFAULT_APPEARANCE);
  });

  it("falls back value by value on what it no longer knows", () => {
    const storage = memoryStorage({
      [APPEARANCE_STORAGE_KEY]: JSON.stringify({ theme: "dark", accentColour: "plum" }),
    });

    expect(readAppearance(storage)).toEqual({ theme: "dark", accentColour: "orange" });
  });

  it("is the default when what's stored isn't JSON", () => {
    expect(readAppearance(memoryStorage({ [APPEARANCE_STORAGE_KEY]: "{" }))).toEqual(DEFAULT_APPEARANCE);
  });
});
