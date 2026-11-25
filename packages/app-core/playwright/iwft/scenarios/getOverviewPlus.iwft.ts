import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};

const promptEvents = (backendSimulator: { analytics: { events: () => { name: string; props: unknown }[] } }) =>
  backendSimulator.analytics.events().filter(({ name }) => name.startsWith("plus.prompt."));

test.describe("Get Overview Plus (351a, 351b)", () => {
  test("on Free the top bar offers it, with its tip, and it opens the paid plans", async ({ page, launcher, backendSimulator }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await launcher.launch(SIGNED_IN);

    await launcher.appShell.verifyGetPlusShown(true);
    await launcher.appShell.verifyGetPlusTipReads("50 overviews a month on us");
    await launcher.appShell.chooseGetPlus();

    await launcher.plansModal.verifyCardsInOrder(["byo-plus", "plus"]);
    await expect
      .poll(() => promptEvents(backendSimulator))
      .toEqual([
        { name: "plus.prompt.shown", props: { variant: "pill", plan: "free" } },
        { name: "plus.prompt.chosen", props: { variant: "pill", plan: "free", outcome: "seePlans" } },
        { name: "plus.prompt.shown", props: { variant: "modal", plan: "free" } },
      ]);
  });

  test("on Free the account menu heads with it, and Plan goes to Settings › Plan", async ({ page, launcher, backendSimulator }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await launcher.launch(SIGNED_IN);
    const menu = await launcher.appShell.accountMenu.open();

    await menu.chooseGetPlus();
    await launcher.plansModal.verifyIsShown();
    await launcher.plansModal.close();
    await menu.verifyTriggerIsFocused();
    await expect
      .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "app.accountMenu.itemChosen"))
      .toEqual([{ name: "app.accountMenu.itemChosen", props: { item: "getPlus" } }]);

    const settings = await (await launcher.appShell.accountMenu.open()).choosePlan();
    await settings.verifySectionIsShown("plan");
  });

  test("on a narrow screen the top bar has no room for it, and the menu still has it", async ({ page, launcher }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await launcher.launch(SIGNED_IN);

    await launcher.appShell.verifyGetPlusShown(false);
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifyItemsRead([
      "Get Overview Plus 50 overviews a month on us",
      "Connect the extension",
      "Settings",
      "Plan",
      "Send feedback",
      "Sign out",
    ]);
  });

  test("a Plus reader is offered it nowhere", async ({ page, launcher, backendSimulator }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    backendSimulator.auth.accountIsOn("plus");
    await launcher.launch({ ...SIGNED_IN, plan: "plus" });

    await launcher.appShell.verifyGetPlusShown(false);
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifyGetPlusAbsent();
  });

  test("a BYO Plus reader sees it only in the menu, once overviews on us are used, naming them", async ({
    page,
    launcher,
    backendSimulator,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    backendSimulator.auth.accountIsOn("byo-plus");
    backendSimulator.ourKey.isAvailable();
    backendSimulator.ourKey.monthHasMade({ ours: 10 });
    await launcher.launch({ ...SIGNED_IN, plan: "byo-plus" });

    await launcher.appShell.verifyGetPlusShown(false);
    const menu = await launcher.appShell.accountMenu.open();
    await menu.verifyItemsRead([
      "Get Overview Plus Your 10 on us are used. Plus has 50 a month",
      "Connect the extension",
      "Settings",
      "Plan",
      "Send feedback",
      "Sign out",
    ]);
  });
});
