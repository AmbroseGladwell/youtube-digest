import { describe, expect, it } from "vitest";
import { PodcastReadFailure } from "@overview/domain";
import { podcastLinkFailureCopy } from "./podcastLinkFailureCopy.js";

describe("podcastLinkFailureCopy", () => {
  it("says on every failure that no overview was used", () => {
    for (const reason of PodcastReadFailure.options) {
      expect(podcastLinkFailureCopy(reason, "The Diary Of A CEO").body).toMatch(/No overview was used\.$/);
    }
  });

  it("names the show it found, and says plainly it won't swap in another episode", () => {
    const copy = podcastLinkFailureCopy("not-found", "The Diary Of A CEO");
    expect(copy.title).toBe("This episode isn’t in The Diary Of A CEO’s public feed");
    expect(copy.body).toContain("We won’t make an overview of a different episode instead.");
  });

  it("calls a show with no public feed a likely Spotify exclusive", () => {
    expect(podcastLinkFailureCopy("no-public-feed", "Night Shift Stories").title).toBe(
      "Night Shift Stories looks like a Spotify exclusive",
    );
  });

  it("offers to try again only when our server didn't hear back", () => {
    expect(podcastLinkFailureCopy("no-answer", null).way).toBe("tryAgain");
    expect(podcastLinkFailureCopy("not-an-episode", null).way).toBe("tryAnother");
  });
});
