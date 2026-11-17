import { CONNECTED_CHAT_INSTRUCTION, chatRecordId, type Connection, type FollowUpQuestion, type Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const QUESTIONS: FollowUpQuestion[] = [
  { question: "How much extra lean mass did people gain when taking creatine alongside strength training?", forReader: false },
  { question: "How does the standard daily creatine dose compare with what influencers now push for brain benefits?", forReader: false },
  { question: "Can taking creatine every day damage your kidneys?", forReader: false },
  { question: "Is it better to take creatine before or after a workout?", forReader: false },
];
const ANSWER = "People who took creatine while strength training gained more lean mass than people who trained without it.";
const LEAN_MASS_POINT = "Taken with strength training, creatine adds a little lean mass.";

const creatine = (): Overview => {
  const overview = makeOverview({
    followUpQuestions: QUESTIONS,
    keyPoints: [
      { text: "The standard dose is a few grams a day.", range: { startMs: 128_000, endMs: 176_000 } },
      { text: LEAN_MASS_POINT, range: { startMs: 208_000, endMs: 263_000 } },
      { text: "The brain claims rest on far larger doses.", range: { startMs: 499_000, endMs: 523_000 } },
    ],
  });
  overview.source.title = "Creatine, debunked";
  return overview;
};

const chatEvents = (events: Array<{ name: string; props: Record<string, unknown> }>) =>
  events.filter(({ name }) => name.startsWith("reader.chat.")).map(({ name, props }) => ({ name, props }));

const claude: Connection = {
  id: "claude",
  clientName: "Claude",
  createdAt: "2026-11-01T12:00:00.000Z",
  lastUsedAt: "2026-11-14T12:00:00.000Z",
  readsProfile: true,
  writes: true,
};

test.describe("Chat beside the note", () => {
  test("a question tapped under the note is answered beside it, citing its stretch, and the note's own field steps aside", async ({
    launcher,
    backendSimulator,
  }) => {
    const overview = creatine();
    backendSimulator.overviews.seed(overview);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.verifyLineReads("Tap one and it’s answered here, from the video. Change");
    await reader.followUps.verifyQuestionNamed(0, `Ask here: ${QUESTIONS[0]!.question}`);
    await reader.chat.verifyNoteFieldIs(true);

    await reader.followUps.clickQuestion(0);

    await reader.chat.verifyIsOpen(true);
    await reader.chat.verifyTitleReads(QUESTIONS[0]!.question);
    await reader.chat.verifyQuestionsRead([QUESTIONS[0]!.question]);
    await reader.chat.verifyAnswersRead([ANSWER]);
    await reader.chat.verifyCitationsRead(0, ["Play the video, 3:28 to 4:23"]);
    await reader.chat.verifyAnnounced(`Answer: ${ANSWER} 1 moment cited.`);
    await reader.chat.verifyFieldIsFocused();
    await reader.chat.verifyNoteFieldIs(false);
    await reader.chat.verifySuggestionsRead([QUESTIONS[1]!.question, QUESTIONS[2]!.question]);
    expect(backendSimulator.chats.questions().map(({ overviewId, text }) => ({ overviewId, text }))).toEqual([
      { overviewId: overview.id, text: QUESTIONS[0]!.question },
    ]);
    await expect.poll(async () => (await backendSimulator.chats.list(overview.id)).map((chat) => chat.messages.length)).toEqual([2]);
    await expect
      .poll(() => chatEvents(backendSimulator.analytics.events()))
      .toEqual([
        { name: "reader.chat.opened", props: expect.objectContaining({ from: "question" }) },
        { name: "reader.chat.asked", props: expect.objectContaining({ from: "question", newConversation: true }) },
        { name: "reader.chat.answered", props: expect.objectContaining({ inSource: true, sourceCitations: 1, conversationCitations: 0 }) },
      ]);
  });

  test("typed in the note's field, a question starts a conversation; the next asks in it, and one the video doesn't cover says so", async ({
    launcher,
    backendSimulator,
  }) => {
    const overview = creatine();
    backendSimulator.overviews.seed(overview);
    backendSimulator.chats.answerWith({
      text: "The video doesn’t say whether to take creatine before or after a workout.",
      inSource: false,
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote(QUESTIONS[3]!.question);

    await reader.chat.verifyNotInSource(0, "Not in the video");
    await reader.chat.verifyAnnounced("Not in the video: The video doesn’t say whether to take creatine before or after a workout.");
    await reader.chat.verifyActionsUnderAnswer(0, "Continue in…");

    await reader.chat.ask("How much lean mass?");

    await reader.chat.verifyTitleReads(QUESTIONS[3]!.question);
    await reader.chat.verifyQuestionsRead([QUESTIONS[3]!.question, "How much lean mass?"]);
    await reader.chat.verifyAnswersRead(["The video doesn’t say whether to take creatine before or after a workout.", ANSWER]);
    await reader.chat.verifyActionsUnderAnswer(1, "Continue in…");
    const [first, second] = backendSimulator.chats.questions();
    expect(second?.conversationId).toBe(first?.conversationId);
  });

  test("following a cited stretch tints the key point it is in and offers the video at that time or the transcript", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(creatine());
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.clickQuestion(0);
    await reader.chat.verifyAnswersRead([ANSWER]);

    await reader.chat.followCitation(0, 0);

    await reader.chat.verifyNoteLineCited(LEAN_MASS_POINT);
    await reader.chat.verifyCitationMenuOffers("Watch from 3:28 on YouTube, opens in a new tab");
    await expect
      .poll(() => chatEvents(backendSimulator.analytics.events()).filter(({ name }) => name === "reader.chat.citationFollowed"))
      .toEqual([{ name: "reader.chat.citationFollowed", props: expect.objectContaining({ to: "source" }) }]);
  });

  test("Stop while an answer is being written keeps nothing and says it didn't count", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(creatine());
    backendSimulator.simulateEndpointStalled(EndpointKey.CHAT_MESSAGES);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.clickQuestion(0);
    await reader.chat.verifyWriting();
    await reader.chat.verifySuggestionsRead([QUESTIONS[1]!.question, QUESTIONS[2]!.question]);

    await reader.chat.stop();

    await reader.chat.verifyStopped();
    await reader.chat.verifySuggestionsRead([QUESTIONS[1]!.question, QUESTIONS[2]!.question]);
    await reader.chat.verifyAnnounced("Stopped");
    await expect
      .poll(() => chatEvents(backendSimulator.analytics.events()).map(({ name }) => name))
      .toEqual(["reader.chat.opened", "reader.chat.asked", "reader.chat.stopped"]);
  });

  test("an answer that fails says so and Try again asks it again in place", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(creatine());
    backendSimulator.chats.failWith();
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("How much lean mass?");

    await reader.chat.verifyFailureReads("Something went wrong answering that. Try again in a while.");
    await reader.chat.tryAgain();
    await reader.chat.verifyQuestionsRead(["How much lean mass?"]);
    await reader.chat.verifyAnswersRead([ANSWER]);
  });

  test("Change offers Here first, and choosing it brings questions back to chat, remembered on every overview", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(creatine());
    const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, followUpAssistant: "claude", questionsAnsweredHere: false });
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.verifyLineReads("Each opens Claude in a new tab with this note filled in. Change");

    await reader.followUps.clickChange();
    await reader.followUps.verifyMenuIs("Answer questions");
    await reader.followUps.chooseAssistant("here");

    await reader.followUps.verifyLineReads("Tap one and it’s answered here, from the video. Change");
    await expect.poll(async () => (await backendSimulator.settingsStore.get()).questionsAnsweredHere).toBe(true);
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "reader.followUps.answerPlaceChosen"))
      .toEqual([{ name: "reader.followUps.answerPlaceChosen", props: expect.objectContaining({ here: true }) }]);
  });

  test("signed out there is no chat, and the questions open an assistant as before", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(creatine());
    const library = await launcher.launchExpectingLibrary({});
    const reader = await library.nthCard(0).openReader();

    await reader.chat.verifyNoteFieldIsAbsent();
    await reader.chat.verifyMenuOffersChat(false);
    await reader.followUps.verifyLineReads("Each opens your assistant. You’ll choose which on your first tap.");
  });

  test("Chat in the overview's menu reopens the latest conversation; Esc closes it and a new one says it can see the others", async ({
    launcher,
    backendSimulator,
  }) => {
    const overview = creatine();
    backendSimulator.overviews.seed(overview);
    backendSimulator.chats.seed({
      id: chatRecordId(overview.id, "earlier"),
      overviewId: overview.id,
      startedAt: "2026-11-12T10:00:00.000Z",
      messages: [
        { from: "reader", text: "What dose do the studies use?", at: "2026-11-12T10:00:00.000Z" },
        {
          from: "answer",
          text: "A few grams a day.",
          at: "2026-11-12T10:00:04.000Z",
          citations: [{ startMs: 128_000, endMs: 176_000 }],
          inSource: true,
        },
      ],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.openFromMenu();

    await reader.chat.verifyTitleReads("What dose do the studies use?");
    await reader.chat.verifyAnswersRead(["A few grams a day."]);
    await reader.chat.verifyFieldIsFocused();

    await reader.chat.newConversation();

    await reader.chat.verifyTitleReads("New conversation");
    await reader.chat.verifyEmptyReads(
      "What would you like to know about this video?Answers come from the video, with the moments they’re from. It can see your 1 other conversation about it.",
    );
    await reader.chat.verifySuggestionsRead(QUESTIONS.slice(0, 3).map(({ question }) => question));

    await reader.chat.pressEscape();

    await reader.chat.verifyIsOpen(false);
    await reader.chat.verifyNoteFieldIs(true);
  });

  test("a question answered here says so under the note, and following that opens its conversation", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seed(creatine());
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.clickQuestion(0);
    await reader.chat.verifyAnswersRead([ANSWER]);
    await reader.followUps.verifyReceiptsRead(["Answered here · just now"]);
    await reader.chat.newConversation();
    await reader.chat.verifyTitleReads("New conversation");

    await reader.followUps.clickReceipt(0);

    await reader.chat.verifyTitleReads(QUESTIONS[0]!.question);
    await reader.chat.close();
    await reader.followUps.clickReceipt(0);
    await reader.chat.verifyIsOpen(true);
    await reader.chat.verifyTitleReads(QUESTIONS[0]!.question);
  });

  test("F6 moves between the note and the chat beside it", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(creatine());
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openFromMenu();
    await reader.chat.verifyFieldIsFocused();

    await reader.chat.pressF6();

    await reader.chat.verifyNoteIsFocused();
    await reader.chat.pressF6();
    await reader.chat.verifyFieldIsFocused();
  });

  test("Continue in Claude, connected, hands it the conversation to read", async ({ launcher, backendSimulator }) => {
    const overview = creatine();
    backendSimulator.overviews.seed(overview);
    backendSimulator.connections.seed(claude);
    const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, followUpAssistant: "claude" });
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("How much lean mass?");
    await reader.chat.verifyActionsUnderAnswer(0, "Continue in Claude");
    await reader.followUps.catchNewTabs();

    await reader.chat.continueIn();

    const conversationId = backendSimulator.chats.questions()[0]!.conversationId;
    const [tab] = await reader.followUps.newTabs();
    expect(tab?.searchParams.get("q")).toBe(
      `${CONNECTED_CHAT_INSTRUCTION}\n<overview>Creatine, debunked (The Overview id ${overview.id})</overview>\n<conversation>${chatRecordId(overview.id, conversationId)}</conversation>`,
    );
  });
});
