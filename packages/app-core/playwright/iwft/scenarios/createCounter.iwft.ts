import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";

const SIGNED_IN_WITHOUT_A_KEY = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};

const counterEvents = (backendSimulator: { analytics: { events: () => { name: string; props: unknown }[] } }) =>
  backendSimulator.analytics
    .events()
    .filter(
      ({ name, props }) =>
        name.startsWith("plus.prompt.") && ["counter", "nudge", "reset"].includes((props as { variant: string }).variant),
    );

test.describe("the counter in Create (351c) and the reset line (351d)", () => {
  test("on Free the counter is quiet while overviews on us count down", async ({ launcher, backendSimulator }) => {
    backendSimulator.ourKey.isAvailable();
    backendSimulator.ourKey.monthHasMade({ ours: 2 });
    await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
    const dialog = await launcher.appShell.openNewOverview();

    await dialog.form.verifyUsageLineReads("3 of 5 left this month · More on 1 November");
    await dialog.form.verifyUsageLineOffersNoPlans();
    await expect
      .poll(() => counterEvents(backendSimulator))
      .toEqual([{ name: "plus.prompt.shown", props: { variant: "counter", plan: "free" } }]);
  });

  test("at the last one it offers the plans, which open the paid plans", async ({ launcher, backendSimulator }) => {
    backendSimulator.ourKey.isAvailable();
    backendSimulator.ourKey.monthHasMade({ ours: 4 });
    await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
    const dialog = await launcher.appShell.openNewOverview();

    await dialog.form.verifyUsageLineReads("1 of 5 left this month · More on 1 November · See plans");
    await dialog.form.clickUsageSeePlans();

    await launcher.plansModal.verifyCardsInOrder(["byo-plus", "plus"]);
    await expect
      .poll(() => counterEvents(backendSimulator))
      .toEqual([
        { name: "plus.prompt.shown", props: { variant: "nudge", plan: "free" } },
        { name: "plus.prompt.chosen", props: { variant: "nudge", plan: "free", outcome: "seePlans" } },
      ]);
  });

  test("on BYO Plus it counts the overviews on us, naming them", async ({ launcher, backendSimulator }) => {
    backendSimulator.auth.accountIsOn("byo-plus");
    backendSimulator.ourKey.isAvailable();
    backendSimulator.ourKey.monthHasMade({ ours: 9 });
    await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, plan: "byo-plus" });
    const dialog = await launcher.appShell.openNewOverview();

    await dialog.form.verifyUsageLineReads("1 of 10 on us left this month · More on 1 November · See plans");
  });

  test("on Plus there is no counter, only the plain line", async ({ launcher, backendSimulator }) => {
    backendSimulator.auth.accountIsOn("plus");
    backendSimulator.ourKey.isAvailable();
    backendSimulator.ourKey.monthHasMade({ ours: 49 });
    await launcher.launch({ ...SIGNED_IN_WITHOUT_A_KEY, plan: "plus" });
    const dialog = await launcher.appShell.openNewOverview();

    await dialog.form.verifyUsageLineReads("1 of 50 left on us this month · Resets 1 November · Plan");
  });

  test("after a month at the limit, the first Create says the overviews are back, once", async ({ launcher, backendSimulator }) => {
    backendSimulator.ourKey.isAvailable();
    backendSimulator.ourKey.lastMonthWasSpent();
    await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
    const dialog = await launcher.appShell.openNewOverview();

    await dialog.form.verifyUsageLineReads("Your 5 are back for October. Make more with Plus · See plans");
    await dialog.form.clickCancel();

    const again = await launcher.appShell.openNewOverview();
    await again.form.verifyUsageLineReads("5 of 5 left this month · More on 1 November");
    await expect
      .poll(() => counterEvents(backendSimulator).filter(({ props }) => (props as { variant: string }).variant === "reset"))
      .toEqual([{ name: "plus.prompt.shown", props: { variant: "reset", plan: "free" } }]);
  });
});
