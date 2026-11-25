import { test } from "../../support/fixtures.testHelper.js";
import { BottomSheetPageObject } from "../../pageObjects/BottomSheetPageObject.testHelper.js";
import { timeSavedSheetTestIds } from "../../../src/features/timeSaved/components/TimeSavedSheet/TimeSavedSheetTestIds.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import type { Launcher } from "../../support/Launcher.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };

// Any sheet would do: Time saved's is the one every library has.
const openASheet = async (launcher: Launcher, backendSimulator: BackendSimulator, overviews = 1) => {
  for (let index = 0; index < overviews; index += 1) {
    backendSimulator.overviews.seed(makeOverview());
  }
  const library = await launcher.launchExpectingLibrary();
  await library.openTimeSaved();
  const sheet = new BottomSheetPageObject(library.testContext, library.testContext.page.getByTestId(timeSavedSheetTestIds.root));
  await sheet.verifyIsOpen();
  return { library, sheet };
};

test.describe("on a phone", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(PHONE);
  });

  test("it rests on the bottom edge, a short drag springs back, and dragging past halfway closes it and gives focus back", async ({
    launcher,
    backendSimulator,
  }) => {
    const { library, sheet } = await openASheet(launcher, backendSimulator);
    await sheet.verifyRestsAtTheBottom();

    await sheet.dragHandle(40, 400);
    await sheet.verifyIsOpen();
    await sheet.verifyRestsAtTheBottom();

    await sheet.dragHandle(600, 400);
    await sheet.verifyIsClosed();
    await library.verifyTimeSavedButtonIsFocused();
  });

  test("a quick flick down closes it", async ({ launcher, backendSimulator }) => {
    const { sheet } = await openASheet(launcher, backendSimulator);

    await sheet.dragHandle(120, 0);

    await sheet.verifyIsClosed();
  });

  test("dragging up takes it to the full height of the screen", async ({ launcher, backendSimulator }) => {
    const { sheet } = await openASheet(launcher, backendSimulator);

    await sheet.dragHandle(-80, 300);

    await sheet.verifyFillsTheScreen();
  });

  test("× and Escape close it without dragging, and it travels down as it leaves", async ({ launcher, backendSimulator }) => {
    const { library, sheet } = await openASheet(launcher, backendSimulator);

    await sheet.pressEscape();
    await sheet.verifyLeavesByTravellingDown();
    await sheet.verifyIsClosed();

    await library.openTimeSaved();
    await sheet.clickClose();
    await sheet.verifyIsClosed();
    await library.verifyTimeSavedButtonIsFocused();
  });
});

test("on a desktop a sheet that is a dialog there sits centred, with no handle to drag", async ({ launcher, backendSimulator, page }) => {
  await page.setViewportSize(DESKTOP);
  const { sheet } = await openASheet(launcher, backendSimulator);

  await sheet.verifyIsCentred();
  await sheet.dragHandle(400, 300);
  await sheet.verifyIsOpen();
});

test.describe("with reduced motion", () => {
  test("it closes at once", async ({ launcher, backendSimulator, page }) => {
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { sheet } = await openASheet(launcher, backendSimulator);

    await sheet.pressEscape();

    await sheet.verifyIsClosed();
  });
});

for (const [where, viewport] of [
  ["a phone", PHONE],
  ["a desktop", DESKTOP],
] as const) {
  test(`on ${where} the page behind an open sheet doesn't scroll, and scrolls again once it closes`, async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { sheet } = await openASheet(launcher, backendSimulator, 40);

    await sheet.verifyPageBehindStaysPut();

    await sheet.pressEscape();
    await sheet.verifyIsClosed();
    await sheet.verifyPageScrollsAgain();
  });
}
