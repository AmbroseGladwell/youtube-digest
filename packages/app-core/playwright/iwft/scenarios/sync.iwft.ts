import { CLIENT_VERSION, CURRENT_SCHEMA_VERSIONS, type RecordChange, type UnreadableRecord } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SERVER = "https://sync.test";
const CONNECTED = { apiUrl: SERVER, token: "session-token", email: SIMULATED_EMAIL };

const overviewChange = (seq: number, overview = makeOverview()): RecordChange => ({
  kind: "overview",
  id: overview.id,
  schemaVersion: CURRENT_SCHEMA_VERSIONS.overview,
  rev: 1,
  seq,
  updatedAt: "2026-09-26T08:30:00.000Z",
  deleted: false,
  body: overview,
});

const heldBackRecord = (id: string): UnreadableRecord => ({
  kind: "overview",
  id,
  schemaVersion: CURRENT_SCHEMA_VERSIONS.overview + 1,
  reason: "future-version",
  detail: "written by a newer version of the app than this one can read",
  salvaged: { savedAt: "2026-09-15T00:00:00.000Z", video: null },
});

// A control that cannot work is worse than no control (CLAUDE.md): a shell with no sync
// storage shows nothing about sync at all.
test("a shell that cannot sync shows no sync controls", async ({ launcher }) => {
  await launcher.launch();
  const settings = await launcher.appShell.openSettings();

  await settings.syncPanel.verifyIsAbsent();
});

test("what the account holds arrives in the library without a reload", async ({ launcher, backendSimulator }) => {
  const arriving = makeOverview({ video: { ...makeOverview().video, title: "Arrived From Another Device" } });
  backendSimulator.sync.seedChange(overviewChange(1, arriving));

  const library = await launcher.launchExpectingLibrary({ sync: true, syncConnection: CONNECTED });

  await library.verifyCountReads("1 overview · 1 unread");
  await library.expectCardCountToBe(1);
  test.expect(await backendSimulator.sync.cursor()).toBe(1);
});

test("a session the server no longer knows is said in settings rather than failing quietly", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointError(EndpointKey.SYNC_HANDSHAKE);
  await launcher.launch({ sync: true, syncConnection: CONNECTED });

  const settings = await launcher.appShell.openSettings();

  await settings.syncPanel.verifyStatusReads(/Sign in again/);
});

test("signing out tells the server and asks to sign in again", async ({ launcher, backendSimulator }) => {
  await launcher.launch({ sync: true, syncConnection: CONNECTED });
  const settings = await launcher.appShell.openSettings();
  await settings.syncPanel.verifyStatusReads(/Synced|Connected/);

  await settings.syncPanel.clickSignOut();

  await settings.syncPanel.verifyAsksToSignIn();
  test.expect(backendSimulator.getCallCount(EndpointKey.SESSION_DELETE)).toBe(1);
});

// An app whose every control fails at the end is worse than an honest wall in front of it
// (docs/features/record-migrations.md, "Below the write floor is a wall").
test("below the server's write floor the web app is walled off with a reload", async ({ launcher, backendSimulator }) => {
  backendSimulator.sync.setMinSupportedClientVersion(CLIENT_VERSION + 1);
  await launcher.launch({ sync: true, syncConnection: CONNECTED });

  const wall = await launcher.appShell.writeFloorWall.verifyIsShown();

  await wall.verifyTitleReads("This version of the app can no longer sync");
  await wall.verifyOffersAction("Reload");
});

test("the extension's wall points at where Chrome updates it, since it cannot reload itself into a newer version", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.sync.setMinSupportedClientVersion(CLIENT_VERSION + 1);
  await launcher.launch({ sync: true, syncConnection: CONNECTED, surface: "extension" });

  const wall = await launcher.appShell.writeFloorWall.verifyIsShown();

  await wall.verifyOffersNoAction();
});

// The soft prompt fires on encounter, not on the handshake: only when records are actually
// being held back (docs/features/record-migrations.md).
test("records from a newer version raise a banner with the count, and a reload on the web", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seedUnreadable(heldBackRecord("7c9e6f3a-1b2d-4e5f-8a9b-0c1d2e3f4a5b"));
  backendSimulator.overviews.seedUnreadable(heldBackRecord("8d0f7a4b-2c3e-4f6a-9b0c-1d2e3f4a5b6c"));
  await launcher.launch();

  const banner = await launcher.appShell.staleClientBanner.verifyIsShown();

  await banner.verifyMessageReads("2 overviews need a newer version of the app");
  await banner.verifyOffersUpdate("Reload");
});

test("a library with nothing held back has no banner", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seedUnreadable({
    ...heldBackRecord("7c9e6f3a-1b2d-4e5f-8a9b-0c1d2e3f4a5b"),
    reason: "invalid",
    schemaVersion: 1,
  });
  await launcher.launch();

  await launcher.appShell.staleClientBanner.verifyIsAbsent();
});

test("the banner stays dismissed across navigation within the session", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seedUnreadable(heldBackRecord("7c9e6f3a-1b2d-4e5f-8a9b-0c1d2e3f4a5b"));
  await launcher.launch();
  const banner = await launcher.appShell.staleClientBanner.verifyIsShown();

  await banner.dismiss();
  await launcher.appShell.openSettings();

  await launcher.appShell.staleClientBanner.verifyIsAbsent();
});

test("in the extension the banner is information unless the shell can act on it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seedUnreadable(heldBackRecord("7c9e6f3a-1b2d-4e5f-8a9b-0c1d2e3f4a5b"));
  await launcher.launch({ surface: "extension" });

  const banner = await launcher.appShell.staleClientBanner.verifyIsShown();

  await banner.verifyOffersNoUpdate();
});
