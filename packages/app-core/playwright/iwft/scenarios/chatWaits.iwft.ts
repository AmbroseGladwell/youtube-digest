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

test.describe("Chat's waits and its usage meter", () => {
  test("a spent month's limit takes the field's place with Plus and the wait, and Not now folds it until tomorrow (351h)", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.refuseWith(429, limit("chat-month", { resetsOn: "2026-12-01" }));
    backendSimulator.chats.setUsage({ used: 100, share: 1, libraryFits: false, resetsOn: "2026-12-01" });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("How much lean mass?");

    await reader.chat.verifyMonthLimitReads(
      "You’ve used this month’s questions on us.",
      "About 1,000 questions a month, against 100. From £7.99 a month, cancel anytime.",
    );
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "reader.chat.waited"))
      .toEqual([{ name: "reader.chat.waited", props: expect.objectContaining({ wait: "month" }) }]);

    await reader.chat.getPlusFromLimit();
    await launcher.plansModal.verifyIsShown();
    await launcher.plansModal.close();

    await reader.chat.putLimitAway();
    await reader.chat.verifyLimitFolded("Asking is back on 1 December");
    await expect
      .poll(() =>
        backendSimulator.analytics
          .events()
          .filter(({ name, props }) => name === "plus.prompt.chosen" && (props as { variant: string }).variant === "chat"),
      )
      .toEqual([
        { name: "plus.prompt.chosen", props: { variant: "chat", plan: "free", outcome: "seePlans" } },
        { name: "plus.prompt.chosen", props: { variant: "chat", plan: "free", outcome: "notNow" } },
      ]);
  });

  test("with BYO Plus's month spent before asking, chat opens on the wait, offering Plus", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.setUsage({ plan: "byo-plus", used: 412, limit: 500, share: 1.02, libraryFits: false, resetsOn: "2026-12-01" });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.openFromMenu();

    await reader.chat.verifyMonthLimitReads(
      "You’ve used this month’s questions on us.",
      "About 1,000 questions a month, against 500. From £7.99 a month, cancel anytime.",
    );
  });

  test("the day's limit and everyone's say tomorrow, with nothing to buy", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.refuseWith(429, limit("chat-day"));
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.askInNote("How much lean mass?");

    await reader.chat.verifyWaitReads(
      "That’s the most chat for one day",
      "Ask again tomorrow. The rest of this month’s chat is still yours.",
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
      "Chat is paused for everyone today",
      "So many readers asked today that we’ve hit our own limit. Ask again tomorrow. Your allowance isn’t touched.",
      null,
    );
  });

  test("under half used nothing shows under the field (376a)", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.setUsage({ used: 30, share: 0.43, resetsOn: "2026-12-01" });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.openFromMenu();

    await reader.chat.verifyMeterReads(null);
  });

  test("from half a quiet line in tens sits under the field, and Settings always has the full meter (376b, 376i)", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.setUsage({ used: 40, share: 0.67, resetsOn: "2026-12-01" });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.openFromMenu();

    await reader.chat.verifyMeterReads("60% of chat used · Resets 1 December");
    const settings = await (await launcher.appShell.openSettings()).openSection("usage");
    await settings.verifyPlanUsageCellReads("chat", ["67% used", "Listening to an answer uses some too."]);
  });

  test("from 90% the line warns once, and offers the plans that give more (376c)", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.setUsage({ used: 80, share: 0.927, libraryFits: false, resetsOn: "2026-12-01" });
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();

    await reader.chat.openFromMenu();

    await reader.chat.verifyMeterReads("92% of chat used · Resets 1 December · See plans", "92% of chat used · Resets 1 December");
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "reader.chat.meterShown"))
      .toEqual([{ name: "reader.chat.meterShown", props: expect.objectContaining({ state: "warning", plan: "free" }) }]);
    await reader.chat.followMeterPlans();
    await launcher.settingsPage.openSection("usage");
    await launcher.settingsPage.verifyPlanUsageCellReads("chat", ["92% used", "Nearly used up. Listening to an answer uses some too."]);
  });

  test("on the Ask page, too little left for a library question says overview questions still work (376h)", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.setUsage({ used: 88, share: 0.97, libraryFits: false, resetsOn: "2026-12-01" });
    await launcher.launchExpectingLibrary(SIGNED_IN);

    const ask = await launcher.appShell.openAsk();

    await ask.verifyWaitReads(
      "Not enough chat left for a library question",
      "A question across your library needs more than you have left this month. Questions about one overview still work until 1 December.",
      "See plans",
    );
  });

  test("on the Ask page the quiet line sits under the field from half used (376g)", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seedSynced(creatine());
    backendSimulator.chats.setUsage({ used: 50, share: 0.72, resetsOn: "2026-12-01" });
    await launcher.launchExpectingLibrary(SIGNED_IN);

    const ask = await launcher.appShell.openAsk();

    await ask.verifyMeterReads("70% of chat used · Resets 1 December");
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
