import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, EMPTY_ABOUT_YOU, type NoteKind } from "@overview/domain";
import { aboutYouAskDue, asksAboutYouBefore } from "./asksAboutYouBefore.js";

const video = (noteKind: NoteKind | null) => ({ kind: "video" as const, noteKind: async () => noteKind });

describe("asksAboutYouBefore", () => {
  it("asks before a podcast, an article and a video that isn't a recipe, or whose kind couldn't be told", async () => {
    const answers = await Promise.all([
      asksAboutYouBefore({ kind: "podcast" }),
      asksAboutYouBefore({ kind: "article", recipe: false }),
      asksAboutYouBefore(video("default")),
      asksAboutYouBefore(video("process")),
      asksAboutYouBefore(video(null)),
    ]);

    expect(answers).toEqual([true, true, true, true, true]);
  });

  it("never asks before a recipe, from a page or a video", async () => {
    expect(await asksAboutYouBefore({ kind: "article", recipe: true })).toBe(false);
    expect(await asksAboutYouBefore(video("recipe"))).toBe(false);
  });
});

describe("aboutYouAskDue", () => {
  it("is due only while About you is empty and it hasn't been asked", () => {
    expect(aboutYouAskDue(DEFAULT_SETTINGS)).toBe(true);
    expect(aboutYouAskDue({ aboutYou: EMPTY_ABOUT_YOU, aboutYouAskedAfterOnboarding: true })).toBe(false);
    expect(aboutYouAskDue({ aboutYou: { who: ["nurse"], time: [], focus: [] }, aboutYouAskedAfterOnboarding: false })).toBe(false);
  });
});
