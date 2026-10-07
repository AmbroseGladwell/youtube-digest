import { test } from "../../support/fixtures.testHelper.js";

const BUILD = { version: "0.1.0", commit: "30bb95a", dirty: false };

// The line at the foot of Settings that says which build this is, so the web app and the
// extension can be checked against each other at a glance (docs/architecture/deploy.md,
// "The version").
test("settings say which version this is, and the commit it was built from", async ({ launcher }) => {
  await launcher.launch({ build: BUILD });
  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("about", "Version 0.1.0");
  await settings.openSection("about");

  await settings.verifyBuildLineReads("Version 0.1.0 (30bb95a)");
});

test("the extension's panel carries the same line", async ({ launcher }) => {
  await launcher.launchPanel({ activeVideoUrl: null, build: BUILD });
  const settings = await (await launcher.appShell.openSettings()).openSection("about");

  await settings.verifyBuildLineReads("Version 0.1.0 (30bb95a)");
});

test("a shell that was told nothing about its build has no About section rather than an empty one", async ({
  launcher,
}) => {
  await launcher.launch();
  const settings = await launcher.appShell.openSettings();

  await settings.verifyRowsAre(["plan", "keys", "milestones", "playlists", "privacy"]);
});
