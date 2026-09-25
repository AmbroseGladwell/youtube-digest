import { describe, expect, it } from "vitest";
import { makeOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import {
  HOW_TO_APPLY_SECTION,
  KEY_POINTS_SECTION,
  noteSectionNames,
  overviewNoteLines,
} from "./overviewNoteLines.js";

describe("overviewNoteLines", () => {
  it("opens with the note's own order: in one line, then the core claim", () => {
    const lines = overviewNoteLines(
      makeOverview({ inOneLine: "A short description.", coreClaim: "The claim." }),
    );

    expect(lines.slice(0, 4)).toEqual([
      { section: "Summary", heading: true, bullet: false, text: "In one line" },
      { section: "Summary", heading: false, bullet: false, text: "A short description." },
      { section: "Core claim", heading: true, bullet: false, text: "Core claim" },
      { section: "Core claim", heading: false, bullet: false, text: "The claim." },
    ]);
  });

  it("titles the claim section 'No clear claim' when the overview is thin", () => {
    const lines = overviewNoteLines(makeOverview({ thin: true, verdict: null }));

    expect(lines).toContainEqual({
      section: "Core claim",
      heading: true,
      bullet: false,
      text: "No clear claim",
    });
    expect(noteSectionNames(lines)).not.toContain("Verdict");
  });

  it("reads the verdict as its label followed by the reasoning", () => {
    const lines = overviewNoteLines(
      makeOverview({
        verdict: {
          novelty: "recycled",
          dubious: false,
          reasoning: "Standard advice.",
          similarTo: [],
        },
      }),
    );

    expect(lines.filter((line) => line.section === "Verdict")).toEqual([
      { section: "Verdict", heading: true, bullet: false, text: "Verdict" },
      { section: "Verdict", heading: false, bullet: false, text: "Recycled." },
      { section: "Verdict", heading: false, bullet: false, text: "Standard advice." },
    ]);
  });

  it("gives every key point and every action its own tappable line", () => {
    const lines = overviewNoteLines(
      makeOverview({
        keyPoints: ["one", "two", "three"],
        howToApply: { items: ["do this", "then this"] },
      }),
    );

    expect(
      lines.filter((line) => line.section === KEY_POINTS_SECTION && !line.heading),
    ).toHaveLength(3);
    expect(lines.filter((line) => line.section === "How to apply" && !line.heading)).toHaveLength(
      2,
    );
  });

  // The note's two list-shaped sections, and only those: the prose sections stay prose.
  it("bullets the key points and the actions, leaving the mark out of the text", () => {
    const lines = overviewNoteLines(
      makeOverview({
        keyPoints: ["Growth beat expectations.", "two", "three"],
        howToApply: { items: ["do this", "and this"] },
      }),
    );

    expect(lines.filter((line) => line.bullet)).toEqual([
      {
        section: KEY_POINTS_SECTION,
        heading: false,
        bullet: true,
        text: "Growth beat expectations.",
      },
      { section: KEY_POINTS_SECTION, heading: false, bullet: true, text: "two" },
      { section: KEY_POINTS_SECTION, heading: false, bullet: true, text: "three" },
      { section: HOW_TO_APPLY_SECTION, heading: false, bullet: true, text: "do this" },
      { section: HOW_TO_APPLY_SECTION, heading: false, bullet: true, text: "and this" },
    ]);
  });

  it("leaves a heading unbulleted, even the one over a bulleted list", () => {
    const lines = overviewNoteLines(makeOverview({ howToApply: { items: ["do this"] } }));

    expect(lines.filter((line) => line.heading).every((line) => !line.bullet)).toBe(true);
  });

  it("leaves out the sections the overview has no content for", () => {
    const sections = noteSectionNames(
      overviewNoteLines(
        makeOverview({
          howToApply: { items: [] },
          selling: { type: "none", detail: "", compromisesContent: false },
          watchAnyway: null,
          chapters: null,
          verdict: null,
        }),
      ),
    );

    expect(sections).toEqual(["Summary", "Core claim", "Key points"]);
  });

  it("carries the selling and watch-anyway answers as prose once they exist", () => {
    const lines = overviewNoteLines(
      makeOverview({
        selling: { type: "own_paid_product", detail: "A £99 course.", compromisesContent: true },
        watchAnyway: { answer: "no", reason: "The note carries it.", range: null },
      }),
    );

    expect(lines).toContainEqual({
      section: "What it sells",
      heading: false,
      bullet: false,
      text: "Sells their own paid product. A £99 course.",
    });
    expect(lines).toContainEqual({
      section: "Watch it anyway?",
      heading: false,
      bullet: false,
      text: "Skip the video, the overview covers it. The note carries it.",
    });
  });

  // The jump control is rendered after the whole note, which only puts it under the
  // watch-it-anyway paragraph for as long as that is the last section built
  // (docs/features/following-playback.md).
  it("builds watch it anyway last, which is what the jump control sits under", () => {
    const lines = overviewNoteLines(
      makeOverview({
        howToApply: { items: ["Do the thing."] },
        watchAnyway: {
          answer: "partial",
          reason: "One stretch earns it.",
          range: { startMs: 0, endMs: 1000 },
        },
      }),
    );

    expect(lines.at(-1)?.section).toBe("Watch it anyway?");
  });
});
