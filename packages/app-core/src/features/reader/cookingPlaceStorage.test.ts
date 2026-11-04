import { describe, expect, it } from "vitest";
import { OverviewId } from "@overview/domain";
import { COOKING_PLACE_KEPT_MS, readCookingPlace, writeCookingPlace } from "./cookingPlaceStorage.js";

const ID = OverviewId.parse("3f0c8a52-6a1f-4c55-9a43-1f2e3d4c5b6a");
const LEFT_AT = Date.UTC(2026, 10, 3, 18, 0);

const memoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
};

describe("cookingPlaceStorage", () => {
  it("keeps the place for a day after the reader left it", () => {
    const storage = memoryStorage();
    writeCookingPlace(ID, { action: 7, leftAt: LEFT_AT }, storage);

    expect(readCookingPlace(ID, LEFT_AT + COOKING_PLACE_KEPT_MS, storage)).toEqual({ action: 7, leftAt: LEFT_AT });
    expect(readCookingPlace(ID, LEFT_AT + COOKING_PLACE_KEPT_MS + 1, storage)).toBeNull();
  });

  it("forgets the place when it is cleared, and reads nothing it can't parse", () => {
    const storage = memoryStorage();
    writeCookingPlace(ID, { action: 2, leftAt: LEFT_AT }, storage);
    writeCookingPlace(ID, null, storage);
    expect(readCookingPlace(ID, LEFT_AT, storage)).toBeNull();

    storage.setItem(`overview.cookingPlace.${ID}`, "{not json");
    expect(readCookingPlace(ID, LEFT_AT, storage)).toBeNull();
  });
});
