import { ACCENT_PALETTES, CURRENT_SCHEMA_VERSIONS, DEFAULT_SETTINGS, type RecordChange } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: "session-token", accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const PHONE = { width: 390, height: 844 };

const settingsChange = (theme: "dark", accentColour: "sky"): RecordChange => ({
  kind: "settings",
  id: "settings",
  schemaVersion: CURRENT_SCHEMA_VERSIONS.settings,
  rev: 2,
  seq: 1,
  updatedAt: "2026-09-26T08:30:00.000Z",
  deleted: false,
  body: { ...DEFAULT_SETTINGS, theme, accentColour },
});

test("a reader who has chosen nothing sees System and Orange, and the page carries no override", async ({ launcher }) => {
  await launcher.launch();
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.verifyRowReads("appearance", "System · Orange");
  await settings.appearance.verifyThemeIs("system");
  await settings.appearance.verifyAccentIs("orange");
  await settings.appearance.verifyPageIs({ theme: null, accent: null });
  await settings.appearance.verifyTokenIs("--brand", "#e2511e");
});

test("choosing a theme and an accent changes the app at once, is saved and is counted", async ({ launcher, backendSimulator }) => {
  await launcher.launch(SIGNED_IN);
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.chooseTheme("dark");
  await settings.appearance.verifyStatusReads("Theme: Dark. Saved to your account.");
  await settings.appearance.chooseAccent("raspberry");

  await settings.appearance.verifyStatusReads("Accent colour: Raspberry. Saved to your account.");
  await settings.appearance.verifyThemeLineReads("Always dark, whatever your device uses.");
  await settings.verifyRowReads("appearance", "Dark · Raspberry");
  await settings.appearance.verifyPageIs({ theme: "dark", accent: "raspberry" });
  await settings.appearance.verifyTokenIs("--mark", ACCENT_PALETTES.raspberry.dark.mark);
  await settings.appearance.verifyTokenIs("--action", ACCENT_PALETTES.raspberry.light.action);
  await settings.appearance.verifyDeviceCopyIs({ theme: "dark", accentColour: "raspberry" });
  await expect.poll(() => launcher.settingsStoreRead()).toMatchObject({ theme: "dark", accentColour: "raspberry" });
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("settings.appearance.")))
    .toEqual([
      { name: "settings.appearance.themeChosen", props: { theme: "dark" } },
      { name: "settings.appearance.accentChosen", props: { accentColour: "raspberry" } },
    ]);
});

test("Gold's labels are dark, because its buttons are bright", async ({ launcher }) => {
  await launcher.launch({ theme: "light", accentColour: "gold" });
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.verifyTokenIs("--on-action", ACCENT_PALETTES.gold.onAction);
  await settings.appearance.verifyTokenIs("--action", ACCENT_PALETTES.gold.light.action);
  await settings.appearance.verifyTokenIs("--mark", ACCENT_PALETTES.gold.light.brand);
});

test("what the account already chose is what a device opens with", async ({ launcher }) => {
  await launcher.launch({ ...SIGNED_IN, theme: "light", accentColour: "teal" });
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.verifyThemeIs("light");
  await settings.appearance.verifyAccentIs("teal");
  await settings.appearance.verifyPageIs({ theme: "light", accent: "teal" });
  await settings.appearance.verifyDeviceCopyIs({ theme: "light", accentColour: "teal" });
});

test("a choice made on another device applies without a reload", async ({ launcher, backendSimulator }) => {
  backendSimulator.sync.seedChange(settingsChange("dark", "sky"));

  await launcher.launch(SIGNED_IN);
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.verifyPageIs({ theme: "dark", accent: "sky" });
  await settings.verifyRowReads("appearance", "Dark · Sky");
  await settings.appearance.verifyDeviceCopyIs({ theme: "dark", accentColour: "sky" });
});

test("System follows the device as it changes, and an override ignores it", async ({ page, launcher }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await launcher.launch({ accentColour: "emerald" });
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");
  await settings.appearance.verifyThemeLineReads("Follows your device, which is light right now.");
  await settings.appearance.verifyTokenIs("--ground", "#f6f4f0");

  await page.emulateMedia({ colorScheme: "dark" });

  await settings.appearance.verifyThemeLineReads("Follows your device, which is dark right now.");
  await settings.appearance.verifyTokenIs("--ground", "#151618");
  await settings.appearance.verifyTokenIs("--accent", ACCENT_PALETTES.emerald.dark.mark);

  await settings.appearance.chooseTheme("light");

  await settings.appearance.verifyTokenIs("--ground", "#f6f4f0");
  await settings.appearance.verifyTokenIs("--accent", ACCENT_PALETTES.emerald.light.accent);
});

test("the alert stays orange-red whichever accent is chosen", async ({ page, launcher }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await launcher.launch({ accentColour: "emerald" });
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.verifyTokenIs("--alert", "#b03c12");

  await settings.appearance.chooseTheme("dark");

  await settings.appearance.verifyTokenIs("--alert", "#f0794a");
});

test("arrow keys move the choice, and it applies as they move", async ({ launcher }) => {
  await launcher.launch();
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.pressArrowDownOnAccent("orange");

  await settings.appearance.verifyAccentIs("gold");
  await settings.appearance.verifyPageIs({ theme: null, accent: "gold" });
});

test("signed out, the status says the choice is on this device", async ({ launcher }) => {
  await launcher.launch();
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.chooseAccent("sky");

  await settings.appearance.verifyStatusReads("Accent colour: Sky. Saved on this device.");
});

test("the accent is handed on to what the extension's pages can't reach", async ({ launcher }) => {
  await launcher.launch({ accentColour: "violet", accentMirror: true });
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.chooseAccent("lime");

  await expect.poll(() => launcher.readAccentMirror()).toEqual(expect.arrayContaining(["violet", "lime"]));
});

test("in the panel both cards start at once with no intro, and the tiles stay big enough to press", async ({ page, launcher }) => {
  await page.setViewportSize({ width: 400, height: 600 });
  await launcher.launchPanel({});
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.verifySectionIntroIsAbsent("appearance");
  await settings.appearance.verifyTilesAreAtLeast(44);
});

test("on a phone the tiles are big enough to press, and every choice is a named radio in a named group", async ({ page, launcher }) => {
  await page.setViewportSize(PHONE);
  await launcher.launch();
  const settings = await (await launcher.appShell.openSettings()).openSection("appearance");

  await settings.appearance.verifyTilesAreAtLeast(44);
  await settings.appearance.verifyChoicesAreNamed();
});
