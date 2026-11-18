import { chatRecordId, type Chat, type Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const NOW = new Date("2026-11-16T18:00:00.000Z");
const DOSE = "How does the standard daily creatine dose compare with what influencers now push for brain benefits?";
const WORKOUT = "Is it better to take creatine before or after a workout?";

const creatine = (): Overview => {
  const overview = makeOverview();
  overview.source.title = "Creatine, debunked";
  return overview;
};

const conversation = (overview: Overview, id: string, at: string, questions: string[]): Chat => ({
  id: chatRecordId(overview.id, id),
  overviewId: overview.id,
  startedAt: at,
  messages: questions.flatMap((text) => [
    { from: "reader" as const, text, at },
    { from: "answer" as const, text: `About: ${text}`, at, citations: [], inSource: true },
  ]),
});

const chatEvents = (events: Array<{ name: string }>) =>
  events.filter(({ name }) => name.startsWith("reader.chat.")).map(({ name }) => name);

test.describe("An overview's conversations", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(NOW);
  });

  test("the header's count opens them, newest first, and one opens where it was left", async ({ launcher, backendSimulator }) => {
    const overview = creatine();
    backendSimulator.overviews.seedSynced(overview);
    backendSimulator.chats.seed(conversation(overview, "older", "2026-11-10T09:00:00.000Z", [WORKOUT]));
    backendSimulator.chats.seed(conversation(overview, "newer", "2026-11-12T09:00:00.000Z", [DOSE, "So the standard dose is enough?"]));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.verifyNoteLinkReads("2 conversations about this video");
    await reader.chat.openFromMenu();
    await reader.chat.verifyTitleReads(DOSE);
    await reader.chat.openMenu();
    await reader.chat.verifyMenuOffers(["Conversations, 2", "Continue in…"]);

    await reader.chat.openList();

    await reader.chat.verifyTitleReads("Conversations");
    await reader.chat.verifyMenuIsOffered(false);
    await reader.chat.verifyConversationsRead([
      { title: DOSE, meta: "12 Nov · 2 questions" },
      { title: WORKOUT, meta: "10 Nov · 1 question" },
    ]);

    await reader.chat.openConversationRow(1);

    await reader.chat.verifyTitleReads(WORKOUT);
    await reader.chat.verifyAnswersRead([`About: ${WORKOUT}`]);
    await reader.chat.verifyFieldIsFocused();
    await expect.poll(() => chatEvents(backendSimulator.analytics.events())).toContain("reader.chat.conversationOpened");
  });

  test("the note's link opens the list", async ({ launcher, backendSimulator }) => {
    const overview = creatine();
    backendSimulator.overviews.seedSynced(overview);
    backendSimulator.chats.seed(conversation(overview, "only", "2026-11-12T09:00:00.000Z", [DOSE]));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.verifyNoteLinkReads("1 conversation about this video");

    await reader.chat.openListFromNote();

    await reader.chat.verifyTitleReads("Conversations");
    await reader.chat.verifyConversationsRead([{ title: DOSE, meta: "12 Nov · 1 question" }]);
  });

  test("deleting is at once, Undo brings it back, and six seconds on the delete is made", async ({ launcher, backendSimulator, page }) => {
    const overview = creatine();
    backendSimulator.overviews.seedSynced(overview);
    backendSimulator.chats.seed(conversation(overview, "older", "2026-11-10T09:00:00.000Z", [WORKOUT]));
    backendSimulator.chats.seed(conversation(overview, "newer", "2026-11-12T09:00:00.000Z", [DOSE]));
    await page.clock.install({ time: NOW });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openListFromNote();

    await reader.chat.deleteConversationRow(0, `Delete conversation: ${DOSE}`);

    await reader.chat.verifyConversationsRead([{ title: WORKOUT, meta: "10 Nov · 1 question" }]);
    await reader.chat.verifyToastReads("Conversation deletedUndo");
    await reader.chat.undo();
    await reader.chat.verifyConversationsRead([
      { title: DOSE, meta: "12 Nov · 1 question" },
      { title: WORKOUT, meta: "10 Nov · 1 question" },
    ]);

    await reader.chat.deleteConversationRow(0, `Delete conversation: ${DOSE}`);
    await page.clock.fastForward(6_000);

    await reader.chat.verifyToastReads(null);
    await expect
      .poll(async () => (await backendSimulator.chats.list(overview.id)).map(({ id }) => id))
      .toEqual([chatRecordId(overview.id, "older")]);
    await reader.chat.verifyNoteLinkReads("1 conversation about this video");
    await expect
      .poll(() => chatEvents(backendSimulator.analytics.events()).filter((name) => name === "reader.chat.conversationDeleted"))
      .toHaveLength(1);
  });

  test("leaving the overview before Undo's time is up still deletes the conversation", async ({ launcher, backendSimulator }) => {
    const overview = creatine();
    backendSimulator.overviews.seedSynced(overview);
    backendSimulator.chats.seed(conversation(overview, "only", "2026-11-12T09:00:00.000Z", [DOSE]));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openListFromNote();

    await reader.chat.deleteConversationRow(0, `Delete conversation: ${DOSE}`);
    await launcher.appShell.clickBrand();

    await expect.poll(async () => backendSimulator.chats.list(overview.id)).toEqual([]);
  });

  test("an answer that drew on another conversation links to it, and following it opens it at that message with a way back", async ({
    launcher,
    backendSimulator,
  }) => {
    const overview = creatine();
    backendSimulator.overviews.seedSynced(overview);
    const earlier = conversation(overview, "earlier", "2026-11-12T09:00:00.000Z", [DOSE]);
    backendSimulator.chats.seed(earlier);
    backendSimulator.chats.answerWith({
      text: "Earlier you settled on the standard few grams a day.",
      citations: [
        { chatId: earlier.id, message: 1 },
        { startMs: 128_000, endMs: 176_000 },
      ],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("What did I decide about the dose?");
    await reader.chat.verifyConversationCitation(0, `Open your conversation from 12 Nov: ${DOSE}`);
    await reader.chat.verifyCitationsRead(0, ["Play the video, 2:08 to 2:56"]);

    await reader.chat.followConversationCitation(0);

    await reader.chat.verifyTitleReads(DOSE);
    await reader.chat.verifyAboutReads("12 Nov · 1 question");
    await reader.chat.verifyQuestionFocused(DOSE);
    await reader.chat.verifyBackReads("Back to “What did I decide about the dose?”");

    await reader.chat.goBack();

    await reader.chat.verifyTitleReads("What did I decide about the dose?");
    await reader.chat.verifyAboutReads("About Creatine, debunked");
    await expect.poll(() => chatEvents(backendSimulator.analytics.events())).toContain("reader.chat.citationFollowed");
  });

  test("a citation of a conversation since deleted says so, and is not a link", async ({ launcher, backendSimulator }) => {
    const overview = creatine();
    backendSimulator.overviews.seedSynced(overview);
    backendSimulator.chats.answerWith({
      text: "You asked about the dose before, but that conversation has been deleted.",
      citations: [{ chatId: chatRecordId(overview.id, "gone"), message: 1 }],
    });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("What did I decide about the dose?");

    await reader.chat.verifyDeletedConversationCited(0);
  });
});
