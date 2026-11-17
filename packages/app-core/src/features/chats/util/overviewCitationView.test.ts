import { describe, expect, it } from "vitest";
import { overviewPartHash, type ChatCitation, type Overview } from "@overview/domain";
import { makeOverview, makePodcastOverview } from "../../overviews/types/OverviewFactory.testHelper.js";
import { overviewCitationViews } from "./overviewCitationView.js";

const overview = makeOverview({
  sourceSteps: {
    items: [
      { text: "Take three grams a day, every day, with food", range: null, dubiousReason: null },
      { text: "Skip loading", range: null, dubiousReason: null },
    ],
  },
  howToApply: { items: ["Add it to your morning shake", "Keep a tub at work"] },
  watchAnyway: { answer: "no", reason: "The note covers it.", range: null },
  chapters: [{ title: "Dosing", summary: "How much to take.", startMs: 0, endMs: 60_000 }],
} as Partial<Overview>);

const cite = (part: "step" | "howToApply" | "watchAnyway" | "chapter" | "keyPoint", index: number, text: string): ChatCitation => ({
  part,
  index,
  textHash: overviewPartHash(text),
});

describe("overviewCitationViews", () => {
  it("labels each part with the note's heading, in the note's order, opening with its first words", () => {
    const views = overviewCitationViews(overview, [
      cite("chapter", 0, "Dosing"),
      cite("step", 0, "Take three grams a day, every day, with food"),
      cite("watchAnyway", 0, "The note covers it."),
    ]);
    expect(views).toEqual([
      { kind: "item", part: "step", index: 0, label: "Step 1", opening: "Take three grams a day, every…" },
      { kind: "item", part: "watchAnyway", index: 0, label: "Watch it anyway?", opening: "The note covers it." },
      { kind: "item", part: "chapter", index: 0, label: "Chapter: Dosing", opening: "Dosing" },
    ]);
  });

  it("numbers How to apply only when one answer cites two of its items", () => {
    const one = overviewCitationViews(overview, [cite("howToApply", 1, "Keep a tub at work")]);
    expect(one.map((view) => view.kind === "item" && view.label)).toEqual(["How to apply"]);
    const two = overviewCitationViews(overview, [
      cite("howToApply", 1, "Keep a tub at work"),
      cite("howToApply", 0, "Add it to your morning shake"),
    ]);
    expect(two.map((view) => view.kind === "item" && view.label)).toEqual(["How to apply, 1", "How to apply, 2"]);
  });

  it("says Listen to it anyway? on an episode", () => {
    const episode = makePodcastOverview({ watchAnyway: { answer: "yes", reason: "Worth it.", range: null } });
    const [view] = overviewCitationViews(episode, [cite("watchAnyway", 0, "Worth it.")]);
    expect(view).toMatchObject({ kind: "item", label: "Listen to it anyway?" });
  });

  it("follows a moved item, keeps a rewritten one's place as changed, and marks a gone section", () => {
    const skip = cite("step", 1, "Skip loading");
    const moved = { ...overview, sourceSteps: { items: [overview.sourceSteps!.items[1]!, overview.sourceSteps!.items[0]!] } };
    expect(overviewCitationViews(moved, [skip])).toEqual([
      { kind: "item", part: "step", index: 0, label: "Step 1", opening: "Skip loading" },
    ]);
    const rewritten = { ...overview, sourceSteps: { items: [{ text: "Something else", range: null, dubiousReason: null }] } };
    expect(overviewCitationViews(rewritten, [skip])).toEqual([{ kind: "changed", part: "step", label: "Step 2" }]);
    expect(overviewCitationViews({ ...overview, sourceSteps: null }, [skip])).toEqual([
      { kind: "gone", part: "step", section: "The steps it gives" },
    ]);
  });

  it("leaves out citations of the video and of other conversations", () => {
    expect(
      overviewCitationViews(overview, [
        { startMs: 0, endMs: 1000 },
        { chatId: "c", message: 0 },
      ]),
    ).toEqual([]);
  });
});
