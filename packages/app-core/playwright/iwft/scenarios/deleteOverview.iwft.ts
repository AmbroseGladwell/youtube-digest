import { CURRENT_SCHEMA_VERSIONS, type Overview, type RecordChange } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const CONNECTED = { apiUrl: "https://sync.test", token: "session-token", email: SIMULATED_EMAIL };

const titled = (title: string, savedAt: string): Overview =>
  makeOverview({ savedAt, video: { ...makeOverview().video, title } });

const tombstone = (seq: number, overview: Overview): RecordChange => ({
  kind: "overview",
  id: overview.id,
  schemaVersion: CURRENT_SCHEMA_VERSIONS.overview,
  rev: 2,
  seq,
  updatedAt: "2026-09-26T08:30:00.000Z",
  deleted: true,
});

test("deleting from the reader's menu asks first, then the note is gone from the library and the store", async ({
  launcher,
  backendSimulator,
}) => {
  const doomed = titled("The One To Delete", "2026-09-20T00:00:00.000Z");
  backendSimulator.overviews.seed(doomed);
  backendSimulator.overviews.seed(titled("The One To Keep", "2026-09-10T00:00:00.000Z"));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.cardWithTitle("The One To Delete").openReader();

  const dialog = await reader.clickDeleteOverview();
  await dialog.verifyBodyMentions("The One To Delete");
  const home = await dialog.clickDelete();

  const after = await home.verifyShowsLibrary();
  await after.expectCardCountToBe(1);
  await after.verifyCountReads("1 overview · 1 unread");
  test.expect(await backendSimulator.overviews.get(doomed.id)).toBeNull();
});

test("the confirm step starts on Cancel, and Cancel or Escape keep the note", async ({ launcher, backendSimulator }) => {
  const kept = titled("Not Deleted After All", "2026-09-20T00:00:00.000Z");
  backendSimulator.overviews.seed(kept);
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  const dialog = await reader.clickDeleteOverview();
  await dialog.verifyFocusIsOnCancel();
  await dialog.clickCancel();
  await dialog.verifyIsNotShown();

  const again = await reader.clickDeleteOverview();
  await again.pressEscape();
  await again.verifyIsNotShown();

  await reader.verifyTitle("Not Deleted After All");
  test.expect(await backendSimulator.overviews.get(kept.id)).not.toBeNull();
});

test("deleting the only note lands on the first-run page", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(titled("The Only One", "2026-09-20T00:00:00.000Z"));
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();

  const dialog = await reader.clickDeleteOverview();
  const home = await dialog.clickDelete();

  await home.verifyShowsFirstRunHero();
});

test("a note deleted on another device leaves the library without a reload", async ({ launcher, backendSimulator }) => {
  const deletedElsewhere = titled("Deleted On The Laptop", "2026-09-20T00:00:00.000Z");
  backendSimulator.overviews.seed(deletedElsewhere);
  backendSimulator.overviews.seed(titled("Still Here", "2026-09-10T00:00:00.000Z"));
  backendSimulator.sync.seedChange(tombstone(1, deletedElsewhere));

  const library = await launcher.launchExpectingLibrary({ sync: true, syncConnection: CONNECTED });

  await library.expectCardCountToBe(1);
  await library.verifyCountReads("1 overview · 1 unread");
});
