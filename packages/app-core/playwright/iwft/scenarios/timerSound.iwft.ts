import { expect, test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL },
};

test("Settings › Cooking chooses the timer sound, saved at once and named on its row", async ({ page, launcher, backendSimulator }) => {
  await launcher.launch(SIGNED_IN);
  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("cooking", "Timer sound: Ready");
  await settings.openSection("cooking");

  await expect(page.getByTestId("TimerSoundPicker.root")).toContainText("Timer sound");
  await expect(page.getByRole("radio", { name: "Ready" })).toBeChecked();
  await expect(page.getByTestId("TimerSoundPicker.row.ready")).toContainText("Your sound");
  await expect(page.getByTestId("TimerSoundPicker.row.rise")).toContainText("Bright notes climbing a chord, for a loud kitchen");

  await page.getByTestId("TimerSoundPicker.row.marimba").locator("label").click();
  await expect(page.getByRole("radio", { name: "Marimba" })).toBeChecked();
  await expect(page.getByTestId("TimerSoundPicker.chosenTag")).toHaveCount(1);
  await expect(page.getByTestId("TimerSoundPicker.row.marimba")).toContainText("Your sound");
  await expect.poll(async () => (await backendSimulator.settingsStore.get()).timerSound).toBe("marimba");
  await settings.verifyRowReads("cooking", "Timer sound: Marimba");
});

test("a sound plays as a sample, one at a time, and can be stopped", async ({ page, launcher }) => {
  await launcher.launch(SIGNED_IN);
  await (await launcher.appShell.openSettings()).openSection("cooking");

  await page.getByRole("button", { name: "Play Harp" }).click();
  await expect(page.getByRole("button", { name: "Stop Harp" })).toBeVisible();
  await page.getByRole("button", { name: "Play Low tone" }).click();
  await expect(page.getByRole("button", { name: "Stop Low tone" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play Harp" })).toBeVisible();
  await page.getByRole("button", { name: "Stop Low tone" }).click();
  await expect(page.getByRole("button", { name: "Play Low tone" })).toBeVisible();
});
