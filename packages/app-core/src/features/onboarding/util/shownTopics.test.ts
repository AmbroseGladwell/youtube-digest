import { describe, expect, it } from "vitest";
import { shownTopics } from "./shownTopics.js";

describe("shownTopics", () => {
  it("shows them all when there are no more than allowed", () => {
    expect(shownTopics(["Food", "Health"], 5)).toEqual({ shown: ["Food", "Health"], more: 0 });
    expect(shownTopics([], 5)).toEqual({ shown: [], more: 0 });
  });

  it("shows the first ones in the reader's order and counts the rest", () => {
    expect(shownTopics(["chess", "Knife skills", "AI", "Science", "Health", "Food", "Home", "Design", "Books"], 5)).toEqual({
      shown: ["chess", "Knife skills", "AI", "Science", "Health"],
      more: 4,
    });
  });
});
