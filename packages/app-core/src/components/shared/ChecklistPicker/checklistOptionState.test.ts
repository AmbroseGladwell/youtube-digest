import { describe, expect, it } from "vitest";
import { checklistOptionState, sharedChecklistFoot } from "./checklistOptionState.js";

describe("checklistOptionState", () => {
  it("is all, some or none by how many hold it", () => {
    expect(checklistOptionState(0, 3)).toBe("none");
    expect(checklistOptionState(1, 3)).toBe("some");
    expect(checklistOptionState(3, 3)).toBe("all");
  });
});

describe("sharedChecklistFoot", () => {
  it("names what all or some of them have", () => {
    expect(
      sharedChecklistFoot(
        [
          { name: "Home", held: 3 },
          { name: "Money", held: 1 },
          { name: "Health", held: 0 },
        ],
        3,
        "None",
      ),
    ).toBe("Home on all 3 · Money on 1");
  });

  it("says so when none has any", () => {
    expect(sharedChecklistFoot([{ name: "Home", held: 0 }], 2, "No topics on these yet")).toBe("No topics on these yet");
  });

  it("names three and counts the rest", () => {
    const options = ["A", "B", "C", "D", "E"].map((name) => ({ name, held: 1 }));
    expect(sharedChecklistFoot(options, 2, "None")).toBe("A on 1 · B on 1 · C on 1 · and 2 more");
  });
});
