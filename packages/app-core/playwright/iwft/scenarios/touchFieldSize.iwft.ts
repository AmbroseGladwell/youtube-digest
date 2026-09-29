import { expect, test } from "../../support/fixtures.testHelper.js";

const IOS_ZOOM_THRESHOLD_PX = 16;

const expectNoneBelowZoomThreshold = (sizes: number[]) =>
  expect(sizes.filter((size) => size < IOS_ZOOM_THRESHOLD_PX)).toEqual([]);

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  test("the home page's field is large enough that iOS does not zoom into it", async ({ launcher }) => {
    const home = await launcher.launch();

    await home.verifyFieldFontSizes(expectNoneBelowZoomThreshold);
  });

  test("the new overview dialog's fields are large enough that iOS does not zoom into them", async ({
    launcher,
  }) => {
    await launcher.launch();
    const dialog = await launcher.appShell.openNewOverview();

    await dialog.verifyFieldFontSizes(expectNoneBelowZoomThreshold);
  });

  test("the settings page's fields are large enough that iOS does not zoom into them", async ({
    launcher,
  }) => {
    await launcher.launch();
    const settings = await launcher.appShell.openSettings();

    await settings.verifyFieldFontSizes(expectNoneBelowZoomThreshold);
  });
});

test("a mouse keeps the design's smaller field sizes", async ({ launcher }) => {
  await launcher.launch();
  const settings = await launcher.appShell.openSettings();

  await settings.verifyFieldFontSizes((sizes) =>
    expect(sizes.some((size) => size < IOS_ZOOM_THRESHOLD_PX)).toBe(true),
  );
});
