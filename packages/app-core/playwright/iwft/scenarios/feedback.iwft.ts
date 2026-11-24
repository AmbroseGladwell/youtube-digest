import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const PHONE = { width: 390, height: 844 };
const PANEL = { width: 400, height: 600 };
const TITLE = "Easy runs and the marathon";
const SENT_WITH = "Submitting includes your account id, the app’s version, the app platform.";
const SENT_WITH_OVERVIEW_AND_TRAIL =
  "Submitting includes your account id, the app’s version, the app platform, this overview, and the last few things you did in the app, so we can retrace them.";

const feedbackEvents = (backendSimulator: BackendSimulator) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("feedback."));

const aboutRunning = () => makeOverview({ source: { ...makeOverview().source, title: TITLE } });

test.describe("from the account menu", () => {
  test("general feedback is written, sent with its kind, thanked, and Done goes back to the menu's button", async ({
    launcher,
    backendSimulator,
  }) => {
    await launcher.launch(SIGNED_IN);
    const menu = await launcher.appShell.accountMenu.open();

    const box = await menu.chooseSendFeedback();
    await box.verifyHeadingReads("Send feedback");
    await box.verifyIsAbout(null);
    await box.verifyFieldIsFocused();
    await box.verifySendIsOff(true);
    await box.verifySentWithReads(SENT_WITH);

    await box.type("A shelf for one channel's overviews");
    await box.chooseKind("idea");
    await box.verifySentWithReads(SENT_WITH);
    await box.verifySendIsOff(false);
    await box.clickSend();

    await box.verifyThanks();
    expect(backendSimulator.feedback.sent()).toEqual([{ text: "A shelf for one channel's overviews", surface: "web", kind: "idea" }]);
    await box.clickDone();
    await box.verifyIsNotShown();
    await menu.verifyTriggerIsFocused();
    await expect
      .poll(() => feedbackEvents(backendSimulator))
      .toEqual([
        { name: "feedback.box.opened", props: { plan: "free", from: "accountMenu" } },
        { name: "feedback.box.sent", props: { plan: "free", kind: "idea", fromOverview: false } },
      ]);
  });

  test("an empty box can't be sent, and a chosen kind is cleared by choosing it again", async ({ launcher, backendSimulator }) => {
    await launcher.launch(SIGNED_IN);
    const box = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();

    await box.verifySendIsOff(true);
    await box.chooseKind("wrong");
    await box.verifyKindPressed("wrong", true);
    await box.chooseKind("wrong");
    await box.verifyKindPressed("wrong", false);
    await box.type("   ");
    await box.verifySendIsOff(true);

    expect(backendSimulator.feedback.sent()).toEqual([]);
  });

  test("a count shows only near the limit", async ({ launcher }) => {
    await launcher.launch(SIGNED_IN);
    const box = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();

    await box.type("x".repeat(3599));
    await box.verifyCountReads(null);
    await box.type("x".repeat(3912));
    await box.verifyCountReads("3,912 of 4,000");
  });
});

test.describe("from an overview's menu", () => {
  test("it says which overview, and Something's wrong sends the overview and the last few actions", async ({
    launcher,
    backendSimulator,
  }) => {
    const overview = aboutRunning();
    backendSimulator.overviews.seed(overview);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.cardWithTitle(TITLE).openReader();

    const box = await reader.clickSendFeedback();
    await box.verifyHeadingReads("Feedback about this overview");
    await box.verifyIsAbout(TITLE);
    await box.type("The verdict missed the point");
    await box.chooseKind("wrong");
    await box.verifySentWithReads(SENT_WITH_OVERVIEW_AND_TRAIL);
    await box.clickSend();

    await box.verifyThanks();
    const [sent] = backendSimulator.feedback.sent();
    expect(sent).toMatchObject({ text: "The verdict missed the point", surface: "web", kind: "wrong", overviewId: overview.id });
    expect(sent!.trail!.map(({ name }) => name)).toContain("reader.actionsMenu.itemChosen");
    await box.clickDone();
    await reader.verifyActionsMenuTriggerIsFocused();
    await expect
      .poll(() => feedbackEvents(backendSimulator).at(-1))
      .toEqual({ name: "feedback.box.sent", props: { plan: "free", kind: "wrong", fromOverview: true } });
  });

  test("with no account, neither menu offers feedback", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(aboutRunning());
    const library = await launcher.launchExpectingLibrary({ sync: false });
    const reader = await library.cardWithTitle(TITLE).openReader();

    await reader.verifyOffersFeedback(false);
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifyItemsRead(["Settings"]);
  });
});

test.describe("when it doesn't send", () => {
  test("offline, the text is kept and Send again sends it", async ({ launcher, backendSimulator }) => {
    backendSimulator.feedback.refuseNext("offline");
    await launcher.launch(SIGNED_IN);
    const box = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();
    await box.type("The player stopped");

    await box.clickSend();
    await box.verifyFailureReads("You’re offline, so it didn’t send. Your text is kept; send it when you’re back online.");
    await box.verifyFieldReads("The player stopped");
    await box.verifySendReads("Send again");
    await box.clickSend();

    await box.verifyThanks();
    expect(backendSimulator.feedback.sent()).toEqual([{ text: "The player stopped", surface: "web" }]);
    await expect.poll(() => feedbackEvents(backendSimulator).map(({ name }) => name)).toContain("feedback.box.failed");
  });

  test("a server error keeps the text and offers Send again", async ({ launcher, backendSimulator }) => {
    backendSimulator.feedback.refuseNext("server");
    await launcher.launch(SIGNED_IN);
    const box = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();
    await box.type("An idea");

    await box.clickSend();

    await box.verifyFailureReads("That didn’t send. Your text is kept; try again in a moment.");
    await box.verifyFieldReads("An idea");
    await box.verifySendReads("Send again");
  });

  test("twenty in an hour turns Send off and keeps the text", async ({ launcher, backendSimulator }) => {
    backendSimulator.feedback.refuseNext("tooMany");
    await launcher.launch(SIGNED_IN);
    const box = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();
    await box.type("One more");

    await box.clickSend();

    await box.verifyFailureReads("You’ve sent a lot this hour. Try again later; your text is kept.");
    await box.verifyFieldReads("One more");
    await box.verifySendIsOff(true);
    await expect
      .poll(() => feedbackEvents(backendSimulator).at(-1))
      .toEqual({ name: "feedback.box.failed", props: { plan: "free", reason: "tooMany" } });
  });
});

test.describe("closing", () => {
  test("closes at once and keeps a draft for that box only, which sending clears", async ({ launcher, backendSimulator }) => {
    backendSimulator.overviews.seed(aboutRunning());
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const general = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();
    await general.type("Half a thought");
    await general.pressEscape();
    await general.verifyIsNotShown();

    const reader = await library.cardWithTitle(TITLE).openReader();
    const aboutIt = await reader.clickSendFeedback();
    await aboutIt.verifyFieldReads("");
    await aboutIt.verifyOffersDraft(false);
    await aboutIt.clickCancel();

    const again = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();
    await again.verifyOffersDraft(true);
    await again.verifyFieldReads("Half a thought");
    await again.clickSend();
    await again.verifyThanks();
    await again.clickDone();

    const after = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();
    await after.verifyFieldReads("");
    await after.verifyOffersDraft(false);
    await expect
      .poll(() => feedbackEvents(backendSimulator).filter(({ name }) => name === "feedback.box.closed"))
      .toEqual([
        { name: "feedback.box.closed", props: { plan: "free", draftKept: true } },
        { name: "feedback.box.closed", props: { plan: "free", draftKept: false } },
      ]);
  });
});

test.describe("how it opens", () => {
  test("a card on a wide screen, and a sheet on a phone", async ({ launcher, page }) => {
    await launcher.launch(SIGNED_IN);
    const wide = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();
    await wide.verifyLaidOutAsSheet(false);
    await wide.clickClose();

    await page.setViewportSize(PHONE);
    const phone = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();
    await phone.verifyLaidOutAsSheet(true);
  });

  test("a sheet in the extension's panel, sending from the extension", async ({ launcher, backendSimulator, page }) => {
    await page.setViewportSize(PANEL);
    await launcher.launchPanel(SIGNED_IN);
    const box = await (await launcher.appShell.accountMenu.open()).chooseSendFeedback();

    await box.verifyLaidOutAsSheet(true);
    await box.type("From the panel");
    await box.clickSend();

    await box.verifyThanks();
    expect(backendSimulator.feedback.sent()).toEqual([{ text: "From the panel", surface: "extension" }]);
  });
});
