import { ShareToken, shareSnapshot } from "@overview/domain";
import { expect, test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeRecipeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const TOKEN = ShareToken.parse("k7Qm2x9RfTabcdef");
const STEPS = [
  { text: "Beat the butter and sugar together until pale.", group: null },
  { text: "Spoon it into the tin and bake for 45 minutes.", group: null },
];

const loaf = () => {
  const base = makeRecipeOverview();
  return makeRecipeOverview({ recipe: { ...base.recipe!, steps: STEPS, stepCount: STEPS.length } });
};

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
};

test.describe("on a shared page", () => {
  test.beforeEach(async ({ page, launcher }) => {
    await page.clock.install();
    await launcher.launchExpectingFirstRun();
    await launcher.inlineSharePayload({
      state: "shared",
      token: TOKEN,
      sharedAt: "2026-11-03T11:00:00.000Z",
      snapshot: shareSnapshot({ overview: loaf(), transcript: null, narration: null }),
    });
    await launcher.openPage(Routes.sharedOverview(TOKEN));
    await launcher.sharedOverviewPage.verifyIsShown();
    await page.getByTestId("RecipeMethod.cook").click();
    await page.getByTestId("CookingMode.forward").click();
    await page.getByRole("button", { name: "Start a 45-minute timer" }).click();
    await page.getByTestId("CookingMode.done").click();
    await page.getByTestId("CookingLeaveSheet.keep").click();
    await expect(page.getByTestId("CookingMode.root")).toBeHidden();
  });

  test("a kept timer sits at the foot of the page, and Back to step opens the shared copy's cooking mode", async ({ page }) => {
    await expect(page.getByTestId("CookingTimerDock.name")).toHaveText(["Bake · Charred leek and white bean stew"]);
    await page.getByTestId("CookingTimerDock.tile").click();
    await expect(page.getByTestId("TimerControlsSheet.wayBack")).toContainText("Back to step 2");
    await page.getByTestId("TimerControlsSheet.wayBack").click();
    await expect(page.getByTestId("CookingMode.root")).toBeVisible();
    await expect(page.getByTestId("CookingMode.place")).toHaveText("Step 2");
  });

  test("Save to my overviews warns the timer will stop: Stay keeps it, Save and stop goes on", async ({ page, backendSimulator }) => {
    await page.getByTestId("SharedOverviewPage.saveButton").click();
    await expect(page.getByTestId("TimersWillStopDialog.heading")).toHaveText("Your bake timer will stop");
    await expect(page.getByTestId("TimersWillStopDialog.sentence")).toHaveText(
      "Saving opens The Overview, and timers on this shared page don’t come with you.",
    );
    await expect(page.getByTestId("TimersWillStopDialog.stay")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("TimersWillStopDialog.root")).toBeHidden();
    await expect(page.getByTestId("CookingTimerDock.tile")).toHaveCount(1);

    await page.getByTestId("SharedOverviewPage.saveButton").click();
    await page.getByTestId("TimersWillStopDialog.go").click();
    await expect(page.getByTestId("SharedOverviewPage.root")).toBeHidden();
    await expect
      .poll(async () => {
        await page.clock.fastForward(60_000);
        return backendSimulator.analytics.sharedPage.events().filter((event) => event.name === "sharedPage.cooking.timerEnded");
      })
      .toMatchObject([{ props: { by: "leftPage", rang: false } }]);
  });

  test("any other way into the app warns too, and staying stays on the page", async ({ page }) => {
    await page.getByRole("link", { name: "Make an overview" }).first().click();
    await expect(page.getByTestId("TimersWillStopDialog.sentence")).toHaveText(
      "Going on opens The Overview, and timers on this shared page don’t come with you.",
    );
    await page.getByTestId("TimersWillStopDialog.stay").click();
    await expect(page.getByTestId("SharedOverviewPage.root")).toBeVisible();
    await expect(page.getByTestId("CookingTimerDock.tile")).toHaveCount(1);

    await page.getByRole("link", { name: "Make an overview" }).first().click();
    await page.getByTestId("TimersWillStopDialog.go").click();
    await expect(page.getByTestId("SharedOverviewPage.root")).toBeHidden();
  });
});

test("signing out with a timer running warns first, and going on stops it", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(loaf());
  const library = await launcher.launchExpectingLibrary(SIGNED_IN);
  await library.nthCard(0).openReader();
  await page.getByTestId("RecipeMethod.cook").click();
  await page.getByTestId("CookingMode.forward").click();
  await page.getByRole("button", { name: "Start a 45-minute timer" }).click();
  await page.getByTestId("CookingMode.done").click();
  await page.getByTestId("CookingLeaveSheet.keep").click();
  await page.getByRole("link", { name: "The Overview" }).first().click();
  await expect(page.getByTestId("LibraryPage.root")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .some(
            (animation) =>
              animation.effect instanceof KeyframeEffect && (animation.effect.pseudoElement ?? "").startsWith("::view-transition"),
          ),
      ),
    )
    .toBe(false);

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByTestId("AccountMenu.signOutItem").click();
  await expect(page.getByTestId("TimersWillStopDialog.heading")).toHaveText("Your bake timer will stop");
  await expect(page.getByTestId("TimersWillStopDialog.sentence")).toHaveText(
    "Signing out stops your timers, since they belong to this account’s recipes.",
  );
  await page.getByTestId("TimersWillStopDialog.stay").click();
  await expect(page.getByTestId("CookingTimerDock.tile")).toHaveCount(1);

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByTestId("AccountMenu.signOutItem").click();
  await expect(page.getByTestId("TimersWillStopDialog.go")).toHaveText("Sign out and stop it");
  await page.getByTestId("TimersWillStopDialog.go").click();
  await expect(page.getByTestId("CookingTimerDock.tile")).toHaveCount(0);
  await expect
    .poll(async () => {
      await page.clock.fastForward(60_000);
      return backendSimulator.analytics.events().filter((event) => event.name === "reader.cooking.timerEnded");
    })
    .toMatchObject([{ props: { by: "signedOut", rang: false } }]);
});
