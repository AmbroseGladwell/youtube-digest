import { describe, expect, it } from "vitest";
import { pastedLinkState } from "./pastedLinkState.js";
import type { PodcastEpisode } from "@overview/domain";

const episode = { title: "An episode" } as PodcastEpisode;

describe("pastedLinkState", () => {
  it("shows a Spotify or Apple link as an episode from the moment it's read", () => {
    expect(pastedLinkState({ status: "none" }, { link: { status: "reading" }, platformLink: true })).toEqual({
      podcastShown: true,
      reading: true,
      generateOffered: true,
    });
  });

  it("keeps a page that may be an episode as an article until our server finds the episode there", () => {
    const pending = pastedLinkState({ status: "reading" }, { link: { status: "reading" }, platformLink: false });
    expect(pending.podcastShown).toBe(false);
    expect(pending.reading).toBe(true);
    const found = pastedLinkState({ status: "reading" }, { link: { status: "found", episode }, platformLink: false });
    expect(found.podcastShown).toBe(true);
    expect(found.reading).toBe(false);
  });

  it("offers nothing to make for an episode that failed or is already held", () => {
    expect(
      pastedLinkState({ status: "none" }, { link: { status: "failed", reason: "not-found", showName: null }, platformLink: true })
        .generateOffered,
    ).toBe(false);
  });
});
