import { beforeEach, describe, expect, it } from "vitest";
import { milestonesColouredHere, rememberMilestonesColoured } from "./milestonesColouredStorage.js";

describe("milestonesColouredStorage", () => {
  beforeEach(() => localStorage.clear());

  it("remembers the milestones coloured in so far, adding to them", () => {
    rememberMilestonesColoured(["30m"]);
    rememberMilestonesColoured(["1h", "30m"]);
    expect([...milestonesColouredHere()]).toEqual(["30m", "1h"]);
  });

  it("reads anything unreadable as none coloured", () => {
    localStorage.setItem("overview.milestonesColoured.v1", "{not json");
    expect(milestonesColouredHere().size).toBe(0);
  });
});

describe("milestonesColouredStorage, when the browser refuses storage", () => {
  const refusing = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  } as unknown as Storage;

  it("remembers nothing and says none were coloured, without throwing", () => {
    expect(() => rememberMilestonesColoured(["30m"], refusing)).not.toThrow();
    expect(milestonesColouredHere(refusing).size).toBe(0);
  });
});
