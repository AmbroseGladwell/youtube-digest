import { describe, expect, it } from "vitest";
import { makeArticleOverview, makeOverview, makePodcastOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { chatOffered } from "./chatOffered.js";

const reader = { signedIn: true, sharedUnsaved: false, synced: true };

describe("chatOffered", () => {
  it("offers asking about a video or an episode to a signed-in reader", () => {
    expect(chatOffered(makeOverview(), reader)).toBe(true);
    expect(chatOffered(makePodcastOverview(), reader)).toBe(true);
  });

  it("hides it for an article, signed out, and on someone else's shared overview", () => {
    expect(chatOffered(makeArticleOverview(), reader)).toBe(false);
    expect(chatOffered(makeOverview(), { ...reader, signedIn: false })).toBe(false);
    expect(chatOffered(makeOverview(), { ...reader, sharedUnsaved: true })).toBe(false);
  });

  it("hides it on an overview the server doesn't hold yet, which it can't answer about", () => {
    expect(chatOffered(makePodcastOverview(), { ...reader, synced: false })).toBe(false);
  });
});
