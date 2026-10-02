import { describe, expect, it } from "vitest";
import {
  forgetReadingPosition,
  readReadingPosition,
  writeReadingPosition,
} from "./readingPositionStorage.js";

const makeStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => void data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
};

const makeRefusingStorage = (): Storage => ({
  ...makeStorage(),
  getItem: () => {
    throw new Error("site data is blocked");
  },
  setItem: () => {
    throw new Error("site data is blocked");
  },
});

describe("readingPositionStorage", () => {
  it("has no position for a video until one is written", () => {
    expect(readReadingPosition("video1", null, makeStorage())).toBeNull();
  });

  it("round-trips a position and forgets it again", () => {
    const storage = makeStorage();
    writeReadingPosition("video1", 65_000, null, storage);
    expect(readReadingPosition("video1", null, storage)).toBe(65_000);

    forgetReadingPosition("video1", null, storage);
    expect(readReadingPosition("video1", null, storage)).toBeNull();
  });

  it("treats stored data that is not a list of positions as no positions", () => {
    const storage = makeStorage();
    storage.setItem("overview.readingPositions.v1", JSON.stringify({ video1: "far" }));
    expect(readReadingPosition("video1", null, storage)).toBeNull();
  });

  it("keeps each account's positions apart from the others and from the no-account library", () => {
    const storage = makeStorage();
    writeReadingPosition("video1", 65_000, "account-a", storage);
    writeReadingPosition("video1", 12_000, null, storage);

    expect(readReadingPosition("video1", "account-a", storage)).toBe(65_000);
    expect(readReadingPosition("video1", "account-b", storage)).toBeNull();
    expect(readReadingPosition("video1", null, storage)).toBe(12_000);
  });

  it("costs nothing but the memory when the browser refuses site data", () => {
    const storage = makeRefusingStorage();
    expect(() => writeReadingPosition("video1", 65_000, null, storage)).not.toThrow();
    expect(readReadingPosition("video1", null, storage)).toBeNull();
  });
});
