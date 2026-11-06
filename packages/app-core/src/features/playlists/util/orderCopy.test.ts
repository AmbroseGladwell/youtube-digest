import { describe, expect, it } from "vitest";
import { orderChangedLine, orderInASentence, orderMeaning, orderWaitEffect } from "./orderCopy.js";

describe("orderMeaning", () => {
  it("says what each order would do, leaving the count to the facts beside it", () => {
    expect(orderMeaning("oldestFirst")).toBe("The one you added longest ago is made first.");
    expect(orderMeaning("newestFirst")).toBe("The one you added most recently is made first.");
    expect(orderMeaning("playlistOrder")).toBe("Made from the top of the playlist down, however you have arranged it.");
  });
});

describe("orderWaitEffect", () => {
  it("says what choosing it would do to the videos already waiting", () => {
    expect(orderWaitEffect("newestFirst", 7)).toBe("The 7 waiting are made newest first");
    expect(orderWaitEffect("playlistOrder", 1)).toBe("The 1 waiting are made in the playlist’s order");
  });

  it("with nothing waiting, says what the order means instead", () => {
    expect(orderWaitEffect("oldestFirst", 0)).toBe("The one you added longest ago is made first.");
  });
});

describe("orderChangedLine", () => {
  it("says what the change did to what waits", () => {
    expect(orderChangedLine("newestFirst", 7)).toBe("Now newest first. The 7 waiting are back in order.");
    expect(orderChangedLine("playlistOrder", 0)).toBe("Now in the playlist’s order.");
  });
});

describe("orderInASentence", () => {
  it("reads inside a sentence", () => {
    expect(orderInASentence("oldestFirst")).toBe("oldest first");
    expect(orderInASentence("playlistOrder")).toBe("in the playlist’s order");
  });
});
