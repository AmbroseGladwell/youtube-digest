import {
  CONNECTED_FOLLOW_UP_INSTRUCTION,
  DEFAULT_SECTIONS_ENABLED,
  ShareToken,
  overviewMarkdown,
  shareSnapshot,
  type Connection,
  type FollowUpQuestion,
  type Overview,
} from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeOverview, makeOverviewState } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const QUESTIONS: FollowUpQuestion[] = [
  { question: "Why does intuition matter most where there is no rapid feedback?", forReader: false },
  { question: "How could public AI conversations help learning in my small software business?", forReader: true },
  { question: "What are slop grenades, and how do they shift the cost of AI work?", forReader: false },
  { question: "Why does working in open channels help people learn to use AI?", forReader: false },
  { question: "What does Tobi mean by choosing among good options?", forReader: false },
  { question: "Why does the Raptor engine show progress needs pruning?", forReader: false },
  { question: "How does Goodhart's law show up in Shopify's view of churn?", forReader: false },
];

const withQuestions = (questions: FollowUpQuestion[]): Overview => makeOverview({ followUpQuestions: questions });

const connection = (clientName: string): Connection => ({
  id: clientName.toLowerCase(),
  clientName,
  createdAt: "2026-11-01T12:00:00.000Z",
  lastUsedAt: "2026-11-14T12:00:00.000Z",
  readsProfile: true,
  writes: true,
});

const followUpEvents = (events: Array<{ name: string; props: Record<string, unknown> }>) =>
  events.filter(({ name }) => name.startsWith("reader.followUps.")).map(({ name, props }) => ({ name, props }));

test("connected to Claude alone, the questions open in it, named in the line, and it reads the note through The Overview", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = withQuestions(QUESTIONS);
  backendSimulator.overviews.seed(overview);
  backendSimulator.connections.seed(connection("Claude"));
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.verifyIsLastInTheNote();
  await reader.followUps.verifyLineReads("Each opens Claude, connected, so it can read this note and its transcript. Change");
  await reader.followUps.verifyQuestionsRead(QUESTIONS.slice(0, 3).map(({ question }) => question));
  await reader.followUps.verifyQuestionNamed(0, `Ask Claude: ${QUESTIONS[0]!.question} (opens in a new tab)`);

  await reader.followUps.catchNewTabs();
  await reader.followUps.clickQuestion(1);

  const [tab] = await reader.followUps.newTabs();
  expect(tab?.origin + tab!.pathname).toBe("https://claude.ai/new");
  expect(tab?.searchParams.get("q")).toBe(
    `${CONNECTED_FOLLOW_UP_INSTRUCTION}\n<question>${QUESTIONS[1]!.question}</question>\n<overview>${overview.source.title} (The Overview id ${overview.id})</overview>`,
  );
  await reader.followUps.verifyAnnounced("Opening Claude in a new tab");
  await expect
    .poll(() => followUpEvents(backendSimulator.analytics.events()))
    .toEqual([
      {
        name: "reader.followUps.asked",
        props: expect.objectContaining({ assistant: "claude", handOff: "prefill", connected: true, forReader: true, position: 2 }),
      },
    ]);
});

test("with no assistant chosen, the first tap asks which, then asks there at once and remembers it", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = withQuestions(QUESTIONS.slice(0, 3));
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.verifyLineReads("Each opens your assistant. You’ll choose which on your first tap.");
  await reader.followUps.verifyQuestionNamed(0, `${QUESTIONS[0]!.question}: choose an assistant to ask`);

  await reader.followUps.clickQuestion(0);
  await reader.followUps.verifyMenuIs("Ask in");
  await reader.followUps.verifyOptionFocused("claude");
  await reader.followUps.verifyMenuOffersCopy(true);
  await reader.followUps.verifyMenuOffersSetUp(true);

  await reader.followUps.pressEscape();
  await reader.followUps.verifyMenuIs(null);
  await reader.followUps.verifyQuestionIsFocused(0);

  await reader.followUps.catchNewTabs();
  await reader.followUps.clickQuestion(0);
  await reader.followUps.chooseAssistant("chatgpt");

  await reader.followUps.verifyMenuIs(null);
  const [tab] = await reader.followUps.newTabs();
  expect(tab?.origin).toBe("https://chatgpt.com");
  expect(tab?.searchParams.get("q")).toBe(
    `<question>${QUESTIONS[0]!.question}</question>\n\n<overview>\n${overviewMarkdown(overview)}</overview>`,
  );
  await reader.followUps.verifyLineReads("Each opens ChatGPT in a new tab with this note filled in. Change");
  await expect
    .poll(() => followUpEvents(backendSimulator.analytics.events()).map(({ name }) => name))
    .toEqual(["reader.followUps.assistantChosen", "reader.followUps.asked"]);
});

test("connected to an assistant, the first-tap menu doesn't suggest setting one up", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withQuestions(QUESTIONS.slice(0, 3)));
  backendSimulator.connections.seed(connection("Claude"));
  backendSimulator.connections.seed(connection("ChatGPT"));
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.clickQuestion(2);

  await reader.followUps.verifyMenuIs("Ask in");
  await reader.followUps.verifyMenuOffersSetUp(false);
});

test("Copy question in the first-tap menu copies the question alone, and remembers nothing", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  backendSimulator.overviews.seed(withQuestions(QUESTIONS.slice(0, 3)));
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.clickQuestion(1);
  await reader.followUps.clickCopyQuestion();

  await reader.followUps.verifyToastReads("Question copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(QUESTIONS[1]!.question);
  await reader.followUps.verifyLineReads("Each opens your assistant. You’ll choose which on your first tap.");
});

test("Gemini can't be filled in by a link, so a tap copies the prompt, opens Gemini and says to paste", async ({
  launcher,
  backendSimulator,
  page,
}) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const overview = withQuestions(QUESTIONS.slice(0, 3));
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, followUpAssistant: "gemini" });
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.verifyLineReads("Each copies the question and this note, then opens Gemini for you to paste. Change");
  await reader.followUps.verifyQuestionNamed(
    0,
    `Copy and open Gemini: ${QUESTIONS[0]!.question} Copies the question and this note, then opens Gemini in a new tab for you to paste`,
  );

  await reader.followUps.catchNewTabs();
  await reader.followUps.clickQuestion(0);

  await reader.followUps.verifyToastReads("Copied. Gemini is opening in a new tab: paste it there.");
  expect((await reader.followUps.newTabs()).map(String)).toEqual(["https://gemini.google.com/app"]);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `<question>${QUESTIONS[0]!.question}</question>\n\n<overview>\n${overviewMarkdown(overview)}</overview>`,
  );
});

test("Change chooses where questions open, without asking anything", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withQuestions(QUESTIONS.slice(0, 3)));
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, followUpAssistant: "claude" });
  const reader = await library.nthCard(0).openReader();
  await reader.followUps.catchNewTabs();

  await reader.followUps.clickChange();
  await reader.followUps.verifyMenuIs("Ask follow-up questions in");
  await reader.followUps.verifyOptionFocused("claude");
  await reader.followUps.verifyMenuOffersCopy(false);
  await reader.followUps.chooseAssistant("gemini");

  await reader.followUps.verifyMenuIs(null);
  await reader.followUps.verifyLineReads("Each copies the question and this note, then opens Gemini for you to paste. Change");
  expect(await reader.followUps.newTabs()).toEqual([]);
});

test("Different questions steps through the sets of three and back to the first, saying where it is", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(withQuestions(QUESTIONS));
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, followUpAssistant: "claude" });
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.verifyDifferentQuestionsIs("Different questions, 1 of 3");

  await reader.followUps.clickDifferentQuestions();
  await reader.followUps.verifyQuestionsRead(QUESTIONS.slice(3, 6).map(({ question }) => question));
  await reader.followUps.verifyDifferentQuestionsIs("Different questions, 2 of 3");
  await reader.followUps.verifyDifferentQuestionsIsFocused();
  await reader.followUps.verifyAnnounced("Questions 4 to 6 of 7");

  await reader.followUps.clickDifferentQuestions();
  await reader.followUps.verifyQuestionsRead([QUESTIONS[6]!.question]);
  await reader.followUps.verifyAnnounced("Question 7 of 7");

  await reader.followUps.clickDifferentQuestions();
  await reader.followUps.verifyQuestionsRead(QUESTIONS.slice(0, 3).map(({ question }) => question));
  await reader.followUps.verifyDifferentQuestionsIs("Different questions, 1 of 3");
  await expect
    .poll(() => followUpEvents(backendSimulator.analytics.events()).map(({ props }) => [props.set, props.sets]))
    .toEqual([
      [2, 3],
      [3, 3],
      [1, 3],
    ]);
});

test("three questions or fewer have no Different questions", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(withQuestions(QUESTIONS.slice(0, 2)));
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.verifyQuestionsRead(QUESTIONS.slice(0, 2).map(({ question }) => question));
  await reader.followUps.verifyDifferentQuestionsIs(null);
});

test("an overview made before questions shows no block", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview({ followUpQuestions: null }));
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.verifyIsNotShown();
});

test("switched off in Settings, questions are hidden, and the switch says they're still written", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(withQuestions(QUESTIONS));
  const library = await launcher.launchExpectingLibrary({
    ...SIGNED_IN,
    sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, followUpQuestions: false },
  });
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.verifyIsNotShown();

  const settings = await (await launcher.appShell.openSettings()).openSection("personalisation");
  await settings.personalisation.verifySwitchIs("Questions to ask next", false);
  await settings.personalisation.verifyFollowUpQuestionsOffNoteIsShown(true);
});

test("a shared copy never carries the questions", async ({ launcher }) => {
  const token = ShareToken.parse("qu3st10nsT0k3nab");
  await launcher.launchExpectingFirstRun();
  await launcher.inlineSharePayload({
    state: "shared",
    token,
    sharedAt: "2026-11-15T11:00:00.000Z",
    snapshot: shareSnapshot({ overview: withQuestions(QUESTIONS), narration: null }),
  });
  await launcher.openPage(Routes.sharedOverview(token));

  const shared = await launcher.sharedOverviewPage.verifyIsShown();
  await shared.followUps.verifyIsNotShown();
});

test("a question taken to an assistant says so under it, and is kept in the reader's own state", async ({ launcher, backendSimulator }) => {
  const overview = withQuestions(QUESTIONS.slice(0, 3));
  backendSimulator.overviews.seed(overview);
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, followUpAssistant: "claude" });
  const reader = await library.nthCard(0).openReader();
  await reader.followUps.verifyReceiptsRead([]);
  await reader.followUps.catchNewTabs();

  await reader.followUps.clickQuestion(1);

  await reader.followUps.verifyReceiptsRead(["Asked in Claude · just now"]);
  await reader.followUps.verifyQuestionDescribed(1, "Asked in Claude · just now");
  await expect
    .poll(async () =>
      (await backendSimulator.overviews.getState(overview.id)).asked.map(({ question, assistant }) => [question, assistant]),
    )
    .toEqual([[QUESTIONS[1]!.question, "claude"]]);
});

test("on a later visit each question asked before says where and how long ago", async ({ launcher, backendSimulator }) => {
  const overview = withQuestions(QUESTIONS.slice(0, 3));
  backendSimulator.overviews.seed(overview);
  backendSimulator.overviews.seedState(
    makeOverviewState(overview.id, {
      asked: [
        { question: QUESTIONS[2]!.question, assistant: "chatgpt", askedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      ],
    }),
  );
  const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, followUpAssistant: "claude" });
  const reader = await library.nthCard(0).openReader();

  await reader.followUps.verifyReceiptsRead(["Asked in ChatGPT · 3 days ago"]);
  await reader.followUps.verifyQuestionDescribed(2, "Asked in ChatGPT · 3 days ago");
});
