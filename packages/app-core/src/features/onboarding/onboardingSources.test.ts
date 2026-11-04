import { describe, expect, it } from "vitest";
import { Source } from "@overview/domain";
import { makeArticleOverview, makeOverview } from "../overviews/types/OverviewFactory.testHelper.js";
import { foundIn, onboardingSourceOf, onboardingSources } from "./onboardingSources.js";

const kindsOfSource = Source.options.map((option) => option.shape.kind.value);

describe("onboardingSources", () => {
  it("has an entry for every kind of source, so a new kind can't ship without its onboarding", () => {
    expect(Object.keys(onboardingSources).sort()).toEqual([...kindsOfSource].sort());
  });

  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "video", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?list=PL590L5WQmH8fJ54F369BLDSqIwcs-TCfs", "video", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/playlist?list=PL590L5WQmH8fJ54F369BLDSqIwcs-TCfs", "playlist", null],
    ["https://theharbourpost.example/2026/11/bridge-bill-twice", "article", null],
  ])("takes %s as a %s", (link, linkKind, key) => {
    const recognised = onboardingSourceOf(link);
    expect(recognised?.linkKind).toBe(linkKind);
    expect(recognised?.source.keyFromLink(link)).toBe(key);
  });

  it.each(["", "not a link", "ftp://files.example/report", "https://www.youtube.com/playlist?list=WL"])(
    "refuses %j",
    (link) => {
      expect(onboardingSourceOf(link)).toBeNull();
    },
  );

  it("makes a video from its key, and an article from the link itself", () => {
    const link = "https://theharbourpost.example/2026/11/bridge-bill-twice";
    expect(onboardingSources.youtube.target({ link, sourceKey: null })).toBeNull();
    expect(onboardingSources.youtube.target({ link, sourceKey: "dQw4w9WgXcQ" })).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(onboardingSources.web.target({ link, sourceKey: null })).toBe(link);
  });

  it("names what was found, so the confirm screen asks about the right thing", () => {
    const article = foundIn(makeArticleOverview());
    expect(onboardingSources.youtube.noun("playlist", null)).toBe("playlist");
    expect(onboardingSources.youtube.noun("video", foundIn(makeOverview()))).toBe("video");
    expect(onboardingSources.web.noun("article", null)).toBe("article");
    expect(onboardingSources.web.noun("article", article)).toBe("article");
    expect(onboardingSources.web.noun("article", { ...article, recipe: true })).toBe("recipe");
  });

  it("gives an article's byline its site and reading time, and a recipe's its kind", () => {
    const article = foundIn(makeArticleOverview());
    expect(onboardingSources.web.byline(article)).toMatch(/ · \d+ min article$/);
    expect(onboardingSources.web.byline({ ...article, recipe: true })).toMatch(/ · Recipe$/);
  });
});
