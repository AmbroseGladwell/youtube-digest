import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectId, type OverviewId, type Plan, type SuggestedQuestion, type SuggestedQuestionScope } from "@overview/domain";
import { createAnalytics } from "../analytics/createAnalytics.js";
import type { AskQuestionOverview, CustomAskQuestion } from "./types/AskQuestion.js";
import { InMemorySuggestedQuestionStore } from "./types/InMemorySuggestedQuestionStore.testHelper.js";
import { makeSuggestedQuestion } from "./types/SuggestedQuestionFactory.testHelper.js";
import { UNDO_QUESTION_MS, useSuggestedQuestionsWith, type SuggestedQuestionsDeps } from "./useSuggestedQuestions.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TEMPLATES = ["What are the big themes?", "Which ideas come up again?", "What could I act on this week?"];
const NOW = new Date("2026-11-23T12:00:00.000Z");
const LIBRARY: SuggestedQuestionScope = { kind: "library" };

const overviewOf = (id: OverviewId): AskQuestionOverview => ({ id, title: "Sleep and focus", kind: "video", imageUrl: null, wide: true });

type Hook = ReturnType<typeof useSuggestedQuestionsWith>;

const Probe = ({ deps, onRender }: { deps: SuggestedQuestionsDeps; onRender: (hook: Hook) => void }) => {
  onRender(useSuggestedQuestionsWith(deps));
  return null;
};

describe("useSuggestedQuestionsWith", () => {
  let root: Root;
  let mounted: boolean;
  let hook: Hook;
  let store: InMemorySuggestedQuestionStore;
  let questions: SuggestedQuestion[];
  let recorded: Array<[string, Record<string, unknown>]>;
  let refresh: ReturnType<typeof vi.fn<(scope: SuggestedQuestionScope) => Promise<unknown>>>;

  const seed = (count: number) => {
    questions = Array.from({ length: count }, (_, index) =>
      makeSuggestedQuestion({ text: `Custom ${index + 1}?`, madeAt: `2026-11-2${count - index}T09:00:00.000Z` }),
    );
    for (const question of questions) {
      store.seedSuggestedQuestion(question);
    }
  };

  const render = (overrides: Partial<SuggestedQuestionsDeps> = {}) => {
    const deps: SuggestedQuestionsDeps = {
      scope: LIBRARY,
      plan: "plus",
      signedIn: true,
      questions,
      templates: TEMPLATES,
      overviewOf,
      showing: true,
      store,
      refresh,
      analytics: createAnalytics({ record: (name, props) => void recorded.push([name, props]), flush: async () => {} }),
      onChanged: () => undefined,
      now: () => NOW,
      ...overrides,
    };
    act(() => root.render(createElement(Probe, { deps, onRender: (next) => (hook = next) })));
    mounted = true;
  };

  const unmount = () => {
    act(() => root.unmount());
    mounted = false;
  };

  const texts = () => hook.questions.map((question) => question.text);
  const custom = (index: number) => hook.questions[index] as CustomAskQuestion;
  const eventsNamed = (name: string) => recorded.filter(([each]) => each === name).map(([, props]) => props);

  beforeEach(() => {
    vi.useFakeTimers();
    root = createRoot(document.createElement("div"));
    store = new InMemorySuggestedQuestionStore();
    questions = [];
    recorded = [];
    refresh = vi.fn<(scope: SuggestedQuestionScope) => Promise<unknown>>(async () => "started");
  });

  afterEach(() => {
    if (mounted) {
      unmount();
    }
    vi.useRealTimers();
  });

  describe("the set", () => {
    it("is exactly today's three templates on a free plan, whatever is on the device", () => {
      seed(2);
      render({ plan: "free" });
      expect(texts()).toEqual(TEMPLATES);
      expect(hook.canCycle).toBe(false);
    });

    it("is the templates while the plan isn't known yet", () => {
      seed(2);
      render({ plan: null });
      expect(texts()).toEqual(TEMPLATES);
    });

    it("puts the reader's questions first, three at a time, and cycles round with Different questions", () => {
      seed(4);
      render();
      expect(texts()).toEqual(["Custom 1?", "Custom 2?", "Custom 3?"]);
      expect(hook).toMatchObject({ page: 0, pages: 3, total: 7, canCycle: true });
      act(() => hook.next());
      expect(texts()).toEqual(["Custom 4?", TEMPLATES[0], TEMPLATES[1]]);
      act(() => hook.next());
      act(() => hook.next());
      expect(hook.page).toBe(0);
      expect(eventsNamed("ask.questions.differentPressed")).toEqual([
        { plan: "plus", scope: "library" },
        { plan: "plus", scope: "library" },
        { plan: "plus", scope: "library" },
      ]);
    });

    it("leaves a question out until both its overviews are on the device", () => {
      seed(1);
      render({ overviewOf: null });
      expect(texts()).toEqual(TEMPLATES);
    });
  });

  describe("shown", () => {
    it("records shownAt once, only for the reader's questions in the three on show", () => {
      seed(4);
      render();
      expect(store.changes).toEqual(questions.slice(0, 3).map(({ id }) => ({ id, change: { shownAt: NOW.toISOString() } })));
      render();
      expect(store.changes).toHaveLength(3);
      act(() => hook.next());
      expect(store.changes.at(-1)).toEqual({ id: questions[3]!.id, change: { shownAt: NOW.toISOString() } });
      expect(store.changes).toHaveLength(4);
    });

    it("records nothing while the questions aren't on screen", () => {
      seed(2);
      render({ showing: false });
      expect(store.changes).toEqual([]);
      expect(eventsNamed("ask.questions.shown")).toEqual([]);
    });

    it("doesn't record a question another device already showed", () => {
      seed(1);
      questions = [{ ...questions[0]!, shownAt: "2026-11-21T09:00:00.000Z" }];
      render();
      expect(store.changes).toEqual([]);
    });

    it("counts each set of three shown, with how many were written for the reader", () => {
      seed(2);
      render();
      render();
      expect(eventsNamed("ask.questions.shown")).toEqual([{ plan: "plus", scope: "library", custom: 2 }]);
    });
  });

  describe("Hide and Not useful", () => {
    it("takes the card away at once, moves the next one up and writes only when Undo's time is up", () => {
      seed(4);
      render();
      store.changes.length = 0;
      act(() => hook.hide(custom(1)));
      expect(texts()).toEqual(["Custom 1?", "Custom 3?", "Custom 4?"]);
      expect(hook.held?.action).toBe("hidden");
      act(() => void vi.advanceTimersByTime(UNDO_QUESTION_MS - 1));
      expect(store.changes.filter(({ change }) => "dismissedAt" in change)).toEqual([]);
      act(() => void vi.advanceTimersByTime(1));
      expect(store.changes).toContainEqual({ id: questions[1]!.id, change: { dismissedAt: NOW.toISOString() } });
      expect(hook.held).toBeNull();
      expect(texts()).toEqual(["Custom 1?", "Custom 3?", "Custom 4?"]);
      expect(eventsNamed("ask.question.dismissed")).toEqual([{ plan: "plus", scope: "library" }]);
    });

    it("writes nothing when undone, and puts the card back", () => {
      seed(2);
      render();
      store.changes.length = 0;
      act(() => hook.notUseful(custom(0)));
      expect(texts()).toEqual(["Custom 2?", TEMPLATES[0], TEMPLATES[1]]);
      act(() => hook.undo());
      act(() => void vi.advanceTimersByTime(UNDO_QUESTION_MS * 2));
      expect(store.changes).toEqual([]);
      expect(texts()).toEqual(["Custom 1?", "Custom 2?", TEMPLATES[0]]);
      expect(eventsNamed("ask.question.undone")).toEqual([{ plan: "plus", scope: "library", action: "notUseful" }]);
      expect(eventsNamed("ask.question.markedObvious")).toEqual([]);
    });

    it("marks Not useful as obvious, dated", () => {
      seed(1);
      render();
      act(() => hook.notUseful(custom(0)));
      act(() => void vi.advanceTimersByTime(UNDO_QUESTION_MS));
      expect(store.changes.at(-1)).toEqual({ id: questions[0]!.id, change: { feedback: { verdict: "obvious", at: NOW.toISOString() } } });
      expect(eventsNamed("ask.question.markedObvious")).toEqual([{ plan: "plus", scope: "library" }]);
    });

    it("writes a held change at once when the page is left", () => {
      seed(1);
      render();
      act(() => hook.hide(custom(0)));
      unmount();
      expect(store.changes.at(-1)).toEqual({ id: questions[0]!.id, change: { dismissedAt: NOW.toISOString() } });
    });

    it("writes the first held change at once when a second card is taken away", () => {
      seed(2);
      render();
      act(() => hook.hide(custom(0)));
      act(() => hook.hide(custom(0)));
      expect(store.changes.at(-1)).toEqual({ id: questions[0]!.id, change: { dismissedAt: NOW.toISOString() } });
      expect(hook.held?.question.id).toBe(questions[1]!.id);
    });
  });

  describe("Good question", () => {
    it("toggles between glad and none, dated", () => {
      seed(1);
      render();
      act(() => hook.toggleGood(custom(0)));
      expect(custom(0).good).toBe(true);
      act(() => hook.toggleGood(custom(0)));
      expect(custom(0).good).toBe(false);
      expect(store.changes.slice(-2)).toEqual([
        { id: questions[0]!.id, change: { feedback: { verdict: "glad", at: NOW.toISOString() } } },
        { id: questions[0]!.id, change: { feedback: { verdict: "none", at: NOW.toISOString() } } },
      ]);
      expect(eventsNamed("ask.question.markedGlad")).toEqual([
        { plan: "plus", scope: "library", glad: true },
        { plan: "plus", scope: "library", glad: false },
      ]);
    });
  });

  describe("asking", () => {
    it("gives the text and both overviews to pin, and records askedAt", () => {
      seed(1);
      render();
      let asked: ReturnType<Hook["ask"]> | undefined;
      act(() => {
        asked = hook.ask(custom(0));
      });
      expect(asked).toEqual({ text: "Custom 1?", pinnedOverviews: questions[0]!.overviewIds });
      expect(store.changes.at(-1)).toEqual({ id: questions[0]!.id, change: { askedAt: NOW.toISOString() } });
      expect(eventsNamed("ask.question.asked")).toEqual([{ plan: "plus", scope: "library", kind: "custom" }]);
    });

    it("pins nothing and writes nothing for a template", () => {
      render({ plan: "free" });
      expect(hook.ask(hook.questions[0]!)).toEqual({ text: TEMPLATES[0], pinnedOverviews: [] });
      expect(store.changes).toEqual([]);
      expect(eventsNamed("ask.question.asked")).toEqual([{ plan: "free", scope: "library", kind: "template" }]);
    });

    it("counts a chip opened from the references menu", () => {
      render();
      hook.chipOpened();
      expect(eventsNamed("ask.question.chipOpened")).toEqual([{ plan: "plus", scope: "library" }]);
    });
  });

  describe("the refresh", () => {
    const settle = () => act(async () => {});

    it("asks once per open, with the scope", async () => {
      render();
      render();
      await settle();
      expect(refresh.mock.calls).toEqual([[LIBRARY]]);
    });

    it("asks again for another scope", async () => {
      const project: SuggestedQuestionScope = { kind: "project", projectId: ProjectId.parse(crypto.randomUUID()) };
      render();
      render({ scope: project });
      await settle();
      expect(refresh.mock.calls).toEqual([[LIBRARY], [project]]);
    });

    it("doesn't ask on a free plan or signed out", async () => {
      render({ plan: "free" });
      unmount();
      root = createRoot(document.createElement("div"));
      render({ signedIn: false });
      await settle();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("swallows a failure", async () => {
      refresh.mockImplementation(async () => {
        throw new Error("offline");
      });
      render();
      await settle();
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("never sends a question's text, a title or an id", () => {
    seed(4);
    render();
    act(() => hook.toggleGood(custom(0)));
    act(() => hook.hide(custom(1)));
    act(() => void vi.advanceTimersByTime(UNDO_QUESTION_MS));
    act(() => hook.notUseful(custom(0)));
    act(() => hook.undo());
    act(() => hook.next());
    act(() => {
      hook.ask(custom(0));
    });
    hook.chipOpened();
    const sent = JSON.stringify(recorded);
    expect(recorded.length).toBeGreaterThan(6);
    for (const question of questions) {
      expect(sent).not.toContain(question.text);
      expect(sent).not.toContain(question.id);
      expect(sent).not.toContain(question.overviewIds[0]);
    }
    expect(sent).not.toContain("Sleep and focus");
    const plans: Plan[] = ["free", "byo-plus", "plus"];
    for (const [, props] of recorded) {
      expect(plans).toContain(props.plan);
    }
  });
});
