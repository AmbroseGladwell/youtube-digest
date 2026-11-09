import { describe, expect, it } from "vitest";
import { Source } from "@overview/domain";
import { makeArticleOverview, makeOverview, makeRecipeOverview } from "../overviews/types/OverviewFactory.testHelper.js";
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

  it.each(["", "not a link", "ftp://files.example/report", "https://www.youtube.com/playlist?list=WL"])("refuses %j", (link) => {
    expect(onboardingSourceOf(link)).toBeNull();
  });

  it("makes a video from its key, and an article from the link itself", () => {
    const link = "https://theharbourpost.example/2026/11/bridge-bill-twice";
    expect(onboardingSources.youtube.target({ link, sourceKey: null })).toBeNull();
    expect(onboardingSources.youtube.target({ link, sourceKey: "dQw4w9WgXcQ" })).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(onboardingSources.web.target({ link, sourceKey: null })).toBe(link);
  });

  const RECIPE = { prepMinutes: 15, cookMinutes: 50, totalMinutes: 65, yield: "4" };

  it("names what was found, so the confirm screen asks about the right thing", () => {
    const article = foundIn(makeArticleOverview());
    expect(onboardingSources.youtube.noun("playlist", null)).toBe("playlist");
    expect(onboardingSources.youtube.noun("video", foundIn(makeOverview()))).toBe("video");
    expect(onboardingSources.web.noun("article", null)).toBe("page");
    expect(onboardingSources.web.noun("article", article)).toBe("article");
    expect(onboardingSources.web.noun("article", { ...article, recipe: RECIPE })).toBe("recipe");
  });

  it("gives an article's card its site and kind, then its author and reading time", () => {
    const overview = makeArticleOverview();
    const card = onboardingSources.web.card(foundIn(overview));
    expect(card.kicker).toMatch(/ · Article$/);
    expect(card.facts).toEqual({ line: expect.stringMatching(/\d+ min read$/) });
  });

  it("gives a recipe's card the page's own times, never summed", () => {
    const card = onboardingSources.web.card({ ...foundIn(makeArticleOverview()), recipe: { ...RECIPE, totalMinutes: null } });
    expect(card.kicker).toMatch(/ · Recipe$/);
    expect(card.facts).toEqual({
      figures: [
        { label: "Prep", value: "15 min" },
        { label: "Cook", value: "50 min" },
        { label: "Makes", value: "4" },
      ],
    });
  });

  it("previews a recipe's ingredients and method as the page's own, and writes only its summary", () => {
    const found = { ...foundIn(makeArticleOverview()), recipe: RECIPE };
    expect(onboardingSources.web.sections(found)).toEqual([
      { name: "Summary", fromPage: false },
      { name: "Ingredients", fromPage: true },
      { name: "Method", fromPage: true },
    ]);
    expect(onboardingSources.web.sections(null).map(({ name }) => name)).toEqual([
      "Premise",
      "Key points",
      "How to apply",
      "Verdict",
      "Chapters",
    ]);
  });

  it("lists the big picture only for a source long enough to earn one", () => {
    const names = (kind: "youtube" | "web", source: Source) =>
      onboardingSources[kind].sections({ source, recipe: null, about: "" }).map(({ name }) => name);
    const video = makeOverview().source;
    const article = makeArticleOverview().source;

    expect(names("youtube", { ...video, durationMs: 10 * 60_000 } as Source)).toContain("Big picture");
    expect(names("youtube", { ...video, durationMs: 9 * 60_000 } as Source)).not.toContain("Big picture");
    expect(names("youtube", { ...video, durationMs: null } as Source)).not.toContain("Big picture");
    expect(names("web", { ...article, wordCount: 1001 } as Source).slice(0, 2)).toEqual(["Premise", "Big picture"]);
    expect(names("web", { ...article, wordCount: 1000 } as Source)).not.toContain("Big picture");
  });

  it("names the big picture among what an account opens, when the overview has one", () => {
    expect(onboardingSources.youtube.teaser(makeOverview({ bigPicture: "The ground." })).locked).toBe(
      "Big picture, key points, How to apply and Verdict open with an account.",
    );
    expect(onboardingSources.youtube.teaser(makeOverview({ bigPicture: null })).locked).toBe(
      "Key points, How to apply and Verdict open with an account.",
    );
  });

  it("says what's in hand by kind once the source is read", () => {
    expect(onboardingSources.youtube.ready(null)).toBe("Transcript ready");
    expect(onboardingSources.web.ready(foundIn(makeArticleOverview()))).toBe("Page read");
    expect(onboardingSources.web.ready({ ...foundIn(makeArticleOverview()), recipe: RECIPE })).toBe("Recipe read");
  });

  it("teases a recipe by its summary and total, and says what an account opens", () => {
    const teaser = onboardingSources.web.teaser(makeRecipeOverview());
    expect(teaser.byline).toMatch(/ · Recipe · 1 hr 5 min$/);
    expect(teaser.first.label).toBe("Summary");
    expect(teaser.locked).toBe("The ingredients and method open with an account.");
    expect(onboardingSources.web.teaser(makeArticleOverview()).byline).toMatch(/ · Article · \d+ min read$/);
  });
});
