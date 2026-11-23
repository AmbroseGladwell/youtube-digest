import { describe, expect, it } from "vitest";
import type { OverviewId } from "@overview/domain";
import type { AskQuestionOverview, CustomAskQuestion } from "../types/AskQuestion.js";
import { makeSuggestedQuestion } from "../types/SuggestedQuestionFactory.testHelper.js";
import { askQuestionPage, askQuestionSet, customAskQuestions, nextAskQuestionPage } from "./askQuestionSet.js";

const TEMPLATES = ["What are the big themes?", "Which ideas come up again?", "What could I act on this week?"];

const overview = (id: OverviewId): AskQuestionOverview => ({ id, title: "A title", kind: "video", imageUrl: null, wide: true });

const customs = (count: number): CustomAskQuestion[] =>
  Array.from({ length: count }, (_, index) => {
    const question = makeSuggestedQuestion({ text: `Custom ${index + 1}?` });
    return {
      kind: "custom",
      id: question.id,
      text: question.text,
      overviews: [overview(question.overviewIds[0]), overview(question.overviewIds[1])],
      good: false,
    };
  });

const texts = (page: ReturnType<typeof askQuestionPage>) => page.questions.map((question) => question.text);

describe("askQuestionSet", () => {
  it("puts the questions written for the reader first, then the templates", () => {
    const set = askQuestionSet(customs(2), TEMPLATES);
    expect(set.map((question) => question.kind)).toEqual(["custom", "custom", "template", "template", "template"]);
  });

  it("is exactly the three templates when nothing was written for the reader", () => {
    const page = askQuestionPage(askQuestionSet([], TEMPLATES), 0);
    expect(texts(page)).toEqual(TEMPLATES);
    expect(page).toMatchObject({ page: 0, pages: 1, canCycle: false });
  });
});

describe("askQuestionPage", () => {
  const set = askQuestionSet(customs(4), TEMPLATES);

  it("shows three at a time and says which of how many", () => {
    expect(texts(askQuestionPage(set, 0))).toEqual(["Custom 1?", "Custom 2?", "Custom 3?"]);
    expect(texts(askQuestionPage(set, 1))).toEqual(["Custom 4?", ...TEMPLATES.slice(0, 2)]);
    expect(texts(askQuestionPage(set, 2))).toEqual([TEMPLATES[2]]);
    expect(askQuestionPage(set, 0)).toMatchObject({ pages: 3, canCycle: true });
  });

  it("wraps to the first set after the last", () => {
    expect(nextAskQuestionPage(askQuestionPage(set, 1))).toBe(2);
    expect(nextAskQuestionPage(askQuestionPage(set, 2))).toBe(0);
  });

  it("can't cycle at three or fewer", () => {
    expect(askQuestionPage(askQuestionSet(customs(0), TEMPLATES), 0).canCycle).toBe(false);
    expect(askQuestionPage(askQuestionSet(customs(1), TEMPLATES), 0).canCycle).toBe(true);
  });

  it("moves the next question up into a removed one's place on the same page", () => {
    const removed = set.filter((question) => question.text !== "Custom 2?");
    expect(texts(askQuestionPage(removed, 0))).toEqual(["Custom 1?", "Custom 3?", "Custom 4?"]);
  });

  it("stays on the last page there is when a removal leaves fewer pages", () => {
    const shorter = askQuestionSet(customs(1), TEMPLATES);
    expect(askQuestionPage(shorter, 2)).toMatchObject({ page: 1, pages: 2 });
  });
});

describe("customAskQuestions", () => {
  const onDevice = makeSuggestedQuestion();
  const missing = makeSuggestedQuestion();
  const held = makeSuggestedQuestion({ feedback: { verdict: "glad", at: "2026-11-21T09:00:00.000Z" } });
  const known = new Set<string>([...onDevice.overviewIds, ...held.overviewIds, missing.overviewIds[0]]);
  const overviewOf = (id: OverviewId) => (known.has(id) ? overview(id) : null);

  it("leaves out a question until both its overviews are on the device, and any held for Undo", () => {
    const made = customAskQuestions([onDevice, missing, held], {
      overviewOf,
      removed: new Set([held.id]),
      goodOf: (question) => question.feedback?.verdict === "glad",
    });
    expect(made.map((question) => question.id)).toEqual([onDevice.id]);
    expect(made[0]?.overviews.map((each) => each.id)).toEqual(onDevice.overviewIds);
  });

  it("says whether the reader marked it a good question", () => {
    const [made] = customAskQuestions([held], {
      overviewOf,
      removed: new Set(),
      goodOf: (question) => question.feedback?.verdict === "glad",
    });
    expect(made?.good).toBe(true);
  });
});
