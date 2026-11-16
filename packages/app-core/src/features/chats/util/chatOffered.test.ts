import { describe, expect, it } from "vitest";
import { makeArticleOverview, makeOverview, makePodcastOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { chatOffered } from "./chatOffered.js";

const reader = { signedIn: true, sharedUnsaved: false };

describe("chatOffered", () => {
  it("offers asking about a video or an episode to a signed-in reader", () => {
    expect(chatOffered(makeOverview(), reader)).toBe(true);
    expect(chatOffered(makePodcastOverview(), reader)).toBe(true);
  });

  it("hides it for an article, signed out, and on someone else's shared overview", () => {
    expect(chatOffered(makeArticleOverview(), reader)).toBe(false);
    expect(chatOffered(makeOverview(), { signedIn: false, sharedUnsaved: false })).toBe(false);
    expect(chatOffered(makeOverview(), { signedIn: true, sharedUnsaved: true })).toBe(false);
  });
});
