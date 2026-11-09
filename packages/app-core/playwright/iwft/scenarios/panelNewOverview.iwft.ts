import { test } from "../../support/fixtures.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
// The panel fetches its own captions, so the Anthropic key alone is enough to create.
const PANEL_OPTIONS = { apiKeys: ANTHROPIC_KEY, youTubeFetch: true };

// Chrome opens the panel around 400 and lets it be dragged wider. Design 205c-2 puts the
// break at the web's own: the phone's sheet below 768, the centred dialog from 768 up.
const PANEL = { width: 400, height: 780 };
const PANEL_DRAGGED_WIDE = { width: 800, height: 900 };

test("at panel width + New opens the phone's sheet over the place it was opened from", async ({ launcher, page }) => {
  await page.setViewportSize(PANEL);
  await launcher.launchPanel(PANEL_OPTIONS);

  const dialog = await launcher.appShell.openNewOverview();

  await dialog.verifyIsTheSheet();
});

test("dragged to 768 or wider the same + New opens the web's dialog instead", async ({ launcher, page }) => {
  await page.setViewportSize(PANEL_DRAGGED_WIDE);
  await launcher.launchPanel(PANEL_OPTIONS);

  const dialog = await launcher.appShell.openNewOverview();

  await dialog.verifyIsTheCentredDialog();
});

for (const [name, viewport] of [
  ["the sheet", PANEL],
  ["the dialog", PANEL_DRAGGED_WIDE],
] as const) {
  test(`${name} takes focus and hands it back to + New when Escape closes it`, async ({ launcher, page }) => {
    await page.setViewportSize(viewport);
    await launcher.launchPanel(PANEL_OPTIONS);
    const dialog = await launcher.appShell.openNewOverview();
    await dialog.verifyCloseHasFocus();

    await dialog.pressEscape();

    await dialog.verifyIsHidden();
    await launcher.appShell.verifyNewOverviewHasFocus();
  });

  test(`${name} closes on the scrim too, and + New gets focus back`, async ({ launcher, page }) => {
    await page.setViewportSize(viewport);
    await launcher.launchPanel(PANEL_OPTIONS);
    const dialog = await launcher.appShell.openNewOverview();

    await dialog.clickScrim();

    await dialog.verifyIsHidden();
    await launcher.appShell.verifyNewOverviewHasFocus();
  });
}

test("creating from the panel's sheet lands on the new note, as creating from home does", async ({ launcher, page }) => {
  await page.setViewportSize(PANEL);
  await launcher.launchPanel(PANEL_OPTIONS);
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyTitle("The Simulated Video");
  await dialog.verifyIsHidden();
});
