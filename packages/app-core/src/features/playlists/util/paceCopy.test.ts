import { describe, expect, it } from "vitest";
import { allowanceLine, paceChangedLine, paceConsequence, paceFacts, paceSpan, paceWaitEffect } from "./paceCopy.js";

describe("paceSpan", () => {
  it("reads a backfill's length in days, and in months once it passes 60", () => {
    expect(paceSpan(1)).toBe("a day");
    expect(paceSpan(5)).toBe("5 days");
    expect(paceSpan(60)).toBe("60 days");
    expect(paceSpan(208)).toBe("7 months");
  });
});

describe("paceConsequence", () => {
  it("says what each pace does to this backfill, as design 95u does", () => {
    expect(paceConsequence("fiveADay", 21, true)).toBe("21 videos at 5 a day: about 5 days.");
    expect(paceConsequence("oneADay", 208, true)).toBe("208 videos at 1 a day: about 7 months.");
    expect(paceConsequence("asTheyCome", 21, true)).toBe("All 21 are made one after another, until this month’s allowance runs out.");
    expect(paceConsequence("whenChosen", 21, true)).toBe(
      "All 21 wait in the queue until you choose them, and use none of your allowance until then.",
    );
  });

  it("a backfill within the day's number is made today", () => {
    expect(paceConsequence("fiveADay", 3, true)).toBe("All 3 today, then up to 5 a day as new ones arrive.");
  });

  it("with nothing to backfill, speaks only of new videos", () => {
    expect(paceConsequence("fiveADay", 0, true)).toBe("New videos from it are made up to 5 a day.");
    expect(paceConsequence("asTheyCome", 21, false)).toBe("New videos from it are made as they arrive.");
    expect(paceConsequence("whenChosen", 0, false)).toBe(
      "New videos wait in the queue until you choose them, and use none of your allowance until then.",
    );
  });
});

describe("paceWaitEffect", () => {
  it("says what each pace would do to the videos already waiting, as design 95y does", () => {
    expect(paceWaitEffect("asTheyCome", 7)).toBe("The 7 waiting carry on now");
    expect(paceWaitEffect("fiveADay", 7)).toBe("7 waiting at 5 a day: about 2 days");
    expect(paceWaitEffect("fiveADay", 4)).toBe("The 4 waiting are made today");
    expect(paceWaitEffect("whenChosen", 7)).toBe("The 7 waiting stay until you choose them");
  });
});

describe("paceChangedLine", () => {
  it("a slower pace says how many of what waits now waits for tomorrow, counting what was made today", () => {
    expect(paceChangedLine("oneADay", 7, 0)).toBe("Now up to 1 a day. 6 of the 7 wait for tomorrow.");
    expect(paceChangedLine("oneADay", 7, 3)).toBe("Now up to 1 a day. 7 of the 7 wait for tomorrow.");
  });

  it("a faster one says what waits carries on", () => {
    expect(paceChangedLine("asTheyCome", 7, 5)).toBe("Now as they come. The 7 waiting carry on now.");
    expect(paceChangedLine("fiveADay", 0, 0)).toBe("Now up to 5 a day.");
  });
});

describe("paceFacts", () => {
  it("reads the pace and what waits on it", () => {
    expect(paceFacts("fiveADay", 7)).toBe("Up to 5 a day · 7 waiting");
    expect(paceFacts("asTheyCome", 0)).toBe("As they come · nothing waiting");
  });
});

describe("allowanceLine", () => {
  it("at a pace, says how long the allowance lasts and when the rest carry on, as 95v does", () => {
    expect(allowanceLine("fiveADay", 21, 10, "2026-11-01")).toBe(
      "Your allowance covers 10 more this month. At 5 a day that’s the next 2 days; the other 11 wait for 1 November, then carry on at 5 a day.",
    );
    expect(allowanceLine("oneADay", 21, 1, "2026-11-01")).toBe(
      "Your allowance covers 1 more this month. At 1 a day that’s today; the other 20 wait for 1 November, then carry on at 1 a day.",
    );
  });

  it("as they come, says how many are made now and that the rest wait, as 95s does", () => {
    expect(allowanceLine("asTheyCome", 19, 10, "2026-11-01")).toBe(
      "10 of these 19 can be made now: you have 10 left this month. The other 9 wait in the queue and carry on by themselves on 1 November.",
    );
  });

  it("says nothing when the allowance covers the backfill, or when the playlist waits to be chosen", () => {
    expect(allowanceLine("fiveADay", 8, 10, "2026-11-01")).toBeNull();
    expect(allowanceLine("whenChosen", 21, 0, "2026-11-01")).toBeNull();
  });

  it("with nothing left, says all of it waits for the month", () => {
    expect(allowanceLine("fiveADay", 21, 0, "2026-11-01")).toBe(
      "Nothing is left of this month’s allowance, so all 21 wait in the queue and carry on by themselves on 1 November.",
    );
  });
});
