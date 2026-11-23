import type { Page } from "@playwright/test";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SUGGESTED_TEXTS, seedSuggestedQuestions } from "../../support/seedSuggestedQuestions.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const PHONE = { width: 390, height: 844 };

const TEMPLATES = [
  "What's worth reading first in my 4 unread overviews?",
  "What are the big themes across everything I've saved?",
  "Which ideas come up again and again in my overviews?",
];

const [FIRST, SECOND, THIRD, FOURTH] = SUGGESTED_TEXTS as [string, string, string, string];

// Chromium's touch emulation is what turns (hover: hover) off.
const useATouchScreen = async (page: Page) => {
  const devtools = await page.context().newCDPSession(page);
  await devtools.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
};

const writtenOf = (changes: Array<{ id: string; change: Record<string, unknown> }>, key: string) =>
  changes.filter(({ change }) => key in change);

test.describe("Suggested questions on the Ask page", () => {
  test("the reader's questions come first, then the templates, three at a time; Different questions cycles, wraps, announces and keeps focus", async ({
    launcher,
    backendSimulator,
  }) => {
    const { questions, titlesOf } = seedSuggestedQuestions(backendSimulator);
    await launcher.launchExpectingLibrary(SIGNED_IN);

    const ask = await launcher.appShell.openAsk();

    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);
    await ask.verifyFeedbackRowCount(3);
    await ask.verifyFeedbackNamed(0, FIRST);
    const [one, two] = titlesOf(questions[0]!);
    await ask.verifyReferencesNamed(0, `2 overviews this question draws on: ${one} and ${two}`);
    await ask.verifyDifferentQuestions("1 of 3");

    await ask.pressDifferentQuestions();

    await ask.verifyQuestionCardsRead([FOURTH, TEMPLATES[0]!, TEMPLATES[1]!]);
    await ask.verifyFeedbackRowCount(1);
    await ask.verifyDifferentQuestions("2 of 3");
    await ask.verifyQuestionsSaid("Questions 4 to 6 of 7");

    await ask.pressDifferentQuestions();

    await ask.verifyQuestionCardsRead([TEMPLATES[2]!]);
    await ask.verifyDifferentQuestions("3 of 3");
    await ask.verifyQuestionsSaid("Question 7 of 7");

    await ask.pressDifferentQuestions();

    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);
    await ask.verifyDifferentQuestions("1 of 3");
    await ask.verifyQuestionsSaid("Questions 1 to 3 of 7");
    expect(backendSimulator.getCallCount(EndpointKey.SUGGESTED_QUESTIONS_REFRESH)).toBe(1);
  });

  test("on desktop the feedback shows on hover or keyboard focus, each with its tip; Good question toggles and writes at once", async ({
    launcher,
    backendSimulator,
  }) => {
    const { questions } = seedSuggestedQuestions(backendSimulator);
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();
    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);

    await ask.verifyFeedbackShown(1, false);
    await ask.focusQuestionCard(1);
    await ask.verifyFeedbackShown(1, true);
    await ask.hoverQuestionCard(0);
    await ask.verifyFeedbackShown(0, true);
    await ask.verifyFeedbackButtonSize(0, 28);
    await ask.verifyFeedbackTipReads(0, "notUseful", "Not useful");

    await ask.pressGoodQuestion(0);

    await ask.verifyGoodQuestionPressed(0, true);
    await expect
      .poll(async () => writtenOf(await backendSimulator.suggestedQuestions.changes(), "feedback"))
      .toEqual([{ id: questions[0]!.id, change: { feedback: { verdict: "glad", at: expect.any(String) } } }]);

    await ask.pressGoodQuestion(0);

    await ask.verifyGoodQuestionPressed(0, false);
    await expect
      .poll(async () => writtenOf(await backendSimulator.suggestedQuestions.changes(), "feedback").at(-1)?.change)
      .toEqual({ feedback: { verdict: "none", at: expect.any(String) } });
    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);
  });

  test("Not useful and Hide take the card away with Undo, which writes nothing; left alone, the change is written after five seconds", async ({
    launcher,
    backendSimulator,
  }) => {
    const { questions } = seedSuggestedQuestions(backendSimulator);
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();
    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);

    await ask.pressNotUseful(0);

    await ask.verifyQuestionCardsRead([SECOND, THIRD, FOURTH]);
    await ask.verifyToastReads("Thanks. We won’t suggest it again.Undo");
    await ask.verifyQuestionCardFocused(0);

    await ask.undo();

    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);
    await ask.verifyToastReads(null);

    await ask.pressHide(1);

    await ask.verifyQuestionCardsRead([FIRST, THIRD, FOURTH]);
    await ask.verifyToastReads("Hidden.Undo");
    await ask.verifyQuestionCardFocused(1);
    expect(writtenOf(await backendSimulator.suggestedQuestions.changes(), "feedback")).toEqual([]);
    expect(writtenOf(await backendSimulator.suggestedQuestions.changes(), "dismissedAt")).toEqual([]);

    await expect
      .poll(async () => writtenOf(await backendSimulator.suggestedQuestions.changes(), "dismissedAt"), { timeout: 10_000 })
      .toEqual([{ id: questions[1]!.id, change: { dismissedAt: expect.any(String) } }]);
    await ask.verifyToastReads(null);
    expect(writtenOf(await backendSimulator.suggestedQuestions.changes(), "feedback")).toEqual([]);
    await ask.verifyQuestionCardsRead([FIRST, THIRD, FOURTH]);
  });

  test("the references menu lists both overviews with their kinds, Escape returns to the button, and a row opens that overview", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    const { questions, overviews, titlesOf } = seedSuggestedQuestions(backendSimulator);
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();
    const kindOf = (title: string) =>
      ({ "Fibre, sleep and the gut": "Podcast episode", "Bean & halloumi stew": "Recipe" })[title] ?? "Video";
    const titles = titlesOf(questions[1]!);

    await ask.openReferences(1);

    await ask.verifyReferencesMenuReads(
      1,
      titles.map((title) => ({ title, kind: kindOf(title) })),
    );

    await ask.closeReferencesWithEscape(1);
    await ask.openReferences(1);
    await ask.chooseReference(1, 1);

    const opened = overviews.find((overview) => overview.source.title === titles[1])!;
    await expect(page).toHaveURL(new RegExp(`/overviews/${opened.id}$`));
  });

  test("asking one of the reader's questions sends it with both its overviews pinned", async ({ launcher, backendSimulator }) => {
    const { questions, titlesOf } = seedSuggestedQuestions(backendSimulator);
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();

    await ask.chooseQuestionCard(0);

    await ask.verifyQuestionsRead([FIRST]);
    expect(backendSimulator.chats.questions()[0]).toMatchObject({
      overviewId: "library",
      text: FIRST,
      pins: { overviews: [...questions[0]!.overviewIds], projects: [] },
    });
    await ask.verifyPinnedRead(0, titlesOf(questions[0]!));
    await expect
      .poll(async () => writtenOf(await backendSimulator.suggestedQuestions.changes(), "askedAt").map(({ id }) => id))
      .toEqual([questions[0]!.id]);
  });

  test("on a free plan it's today's three starters, with no feedback and no Different questions", async ({
    launcher,
    backendSimulator,
  }) => {
    seedSuggestedQuestions(backendSimulator);
    backendSimulator.chats.setUsage({ plan: "free" });
    await launcher.launchExpectingLibrary(SIGNED_IN);

    const ask = await launcher.appShell.openAsk();

    await ask.verifyStartersRead(TEMPLATES);
    await ask.verifyNoQuestionCards();
  });

  test("offline the questions still show and asking one waits, as a typed question does", async ({
    launcher,
    backendSimulator,
    context,
  }) => {
    seedSuggestedQuestions(backendSimulator);
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();
    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);

    await context.setOffline(true);

    await ask.verifyWaitReads("You’re offline", "Ask again when you’re back online.", null);
    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);

    await ask.verifyQuestionCardsWait(true);

    await context.setOffline(false);

    await ask.verifyQuestionCardsWait(false);
  });

  test("on a phone's touch screen the feedback always shows at 36px, and a long press on Hide names it", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    seedSuggestedQuestions(backendSimulator);
    await page.setViewportSize(PHONE);
    await useATouchScreen(page);
    await launcher.launchExpectingLibrary(SIGNED_IN);
    const ask = await launcher.appShell.openAsk();
    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);

    await ask.verifyFeedbackShown(0, true);
    await ask.verifyFeedbackShown(2, true);
    await ask.verifyFeedbackButtonSize(0, 36);
    await ask.holdFeedbackButton(0, "hide", "Hide");
    await ask.verifyQuestionCardsRead([FIRST, SECOND, THIRD]);
  });
});
