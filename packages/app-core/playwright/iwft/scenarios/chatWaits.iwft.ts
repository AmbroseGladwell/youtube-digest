import { MAX_CHAT_QUESTIONS, chatRecordId, type Chat, type Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};

const creatine = (): Overview => {
  const overview = makeOverview({
    followUpQuestions: [
      { question: "How much extra lean mass did people gain?", forReader: false },
      { question: "How does the standard dose compare?", forReader: false },
    ],
  });
  overview.source.title = "Creatine, debunked";
  return overview;
};

const limit = (quota: string, details: Record<string, unknown> = {}) => ({
  code: "too_many_requests",
  details: { quota, retryAfterSeconds: 3600, ...details },
});

test.describe("Chat's waits and what's left", () => {
  test("a spent month takes the field's place, says when it's back and offers the plans that give more", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.refuseWith(429, limit("chat-month", { resetsOn: "2026-12-01" }));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    backendSimulator.chats.setUsage({ used: 100, resetsOn: "2026-12-01" });

    await reader.chat.askInNote("How much lean mass?");

    await reader.chat.verifyWaitReads(
      "You’ve asked this month’s 100 questions on us",
      "More on 1 December. BYO Plus gives 500 a month, Plus 1,000. Making overviews isn’t affected.",
      "See plans",
    );
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "reader.chat.waited"))
      .toEqual([{ name: "reader.chat.waited", props: expect.objectContaining({ wait: "month" }) }]);

    await reader.chat.clickWaitAction();

    await launcher.settingsPage.verifyPlanUsageCellReads("questions", ["0 of 100 left", "None left. More on 1 December."]);
  });

  test("with BYO Plus's month spent before asking, chat opens on the wait, offering Plus", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.setUsage({ plan: "byo-plus", used: 500, limit: 500, resetsOn: "2026-12-01" });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.openFromMenu();

    await reader.chat.verifyWaitReads(
      "You’ve asked this month’s 500 questions on us",
      "More on 1 December. Plus gives 1,000 a month. Making overviews isn’t affected.",
      "See Plus",
    );
  });

  test("the day's limit and everyone's say tomorrow, with nothing to buy", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.refuseWith(429, limit("chat-day"));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("How much lean mass?");

    await reader.chat.verifyWaitReads(
      "That’s the most questions for one day",
      "Ask again tomorrow. The rest of this month’s questions are still yours.",
      null,
    );
  });

  test("everyone's day spent says so, without blame or a plan", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.refuseWith(429, limit("chat-our-key-daily"));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("How much lean mass?");

    await reader.chat.verifyWaitReads(
      "Questions are paused for everyone today",
      "So many readers asked today that we’ve hit our own limit. Ask again tomorrow.",
      null,
    );
  });

  test("ten or fewer left shows a line under the field; the list's foot always says what's left", async ({
    launcher,
    backendSimulator,
  }) => {
    const overview = creatine();
    backendSimulator.overviews.seedSynced(overview);
    backendSimulator.chats.setUsage({ used: 89, limit: 100, resetsOn: "2026-12-01" });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openFromMenu();
    await reader.chat.verifyLeftReads(null);

    await reader.chat.ask("How much lean mass?");

    await reader.chat.verifyLeftReads("10 questions left this month, on us");
    await reader.chat.close();
    await reader.chat.openListFromNote();
    await reader.chat.verifyLeftReads("10 of 100 questions left this month, on us. More on 1 December.");
  });

  test("a conversation at 50 questions offers a new one in the field's place, which can see it", async ({ launcher, backendSimulator }) => {
    const overview = creatine();
    backendSimulator.overviews.seedSynced(overview);
    const at = "2026-11-12T09:00:00.000Z";
    const full: Chat = {
      id: chatRecordId(overview.id, "full"),
      overviewId: overview.id,
      startedAt: at,
      messages: Array.from({ length: MAX_CHAT_QUESTIONS }, (_, index) => [
        { from: "reader" as const, text: `Question ${index + 1}?`, at },
        { from: "answer" as const, text: `Answer ${index + 1}.`, at, citations: [], inSource: true },
      ]).flat(),
    };
    backendSimulator.chats.seed(full);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.openFromMenu();

    await reader.chat.verifyAboutReads("About Creatine, debunked · 50 questions");
    await reader.chat.verifyWaitReads(
      "This conversation has 50 questions, the most one can hold.",
      "Start a new one. It can see this one.",
      "New conversation",
    );
    await reader.chat.clickWaitAction();
    await reader.chat.verifyTitleReads("New conversation");
    await reader.chat.verifyNoWait();
  });

  test("offline, the field gives way to saying so, and comes back with the connection", async ({ launcher, backendSimulator, context }) => {
    backendSimulator.overviews.seedSynced(creatine());
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openFromMenu();

    await context.setOffline(true);

    await reader.chat.verifyWaitReads("You’re offline", "Ask again when you’re back online.", null);
    await context.setOffline(false);
    await reader.chat.verifyNoWait();
  });

  test("no words four seconds after asking says it's still working, and Stop still works", async ({ launcher, backendSimulator, page }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.simulateEndpointStalled(EndpointKey.CHAT_MESSAGES);
    await page.clock.install();
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("How much lean mass?");

    await page.clock.fastForward(4_000);

    await reader.chat.verifySlowReads("Still working on it…");
    await reader.chat.stop();
    await reader.chat.verifyStopped();
  });
});
