import type { UnreadableRecord } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const UNREADABLE_ID = "7c9e6f3a-1b2d-4e5f-8a9b-0c1d2e3f4a5b";
const VIDEO_URL = "https://www.youtube.com/watch?v=unreadableVideo";

const unreadableRecord = (overrides: Partial<UnreadableRecord> = {}): UnreadableRecord => ({
  kind: "overview",
  id: UNREADABLE_ID,
  schemaVersion: 1,
  reason: "invalid",
  detail: "coreClaim: expected string",
  salvaged: {
    savedAt: "2026-09-15T00:00:00.000Z",
    video: { id: null, url: VIDEO_URL, title: "The Unreadable Video" },
  },
  ...overrides,
});

// A library that shows two and holds three is the prototype's eleven missing notes with a
// new address (docs/features/record-migrations.md).
test("a record that cannot be read sits in the library where the reader left it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(
    makeOverview({
      savedAt: "2026-09-16T00:00:00.000Z",
      video: { ...makeOverview().video, title: "A Readable Video" },
    }),
  );
  backendSimulator.overviews.seed(
    makeOverview({
      savedAt: "2026-09-14T00:00:00.000Z",
      video: { ...makeOverview().video, title: "An Older Readable Video" },
    }),
  );
  backendSimulator.overviews.seedUnreadable(unreadableRecord());

  const library = await launcher.launchExpectingLibrary();

  await library.verifyCountReads("3 overviews · 3 unread");
  await library.unreadableCard.verifyIsShown();
  await library.unreadableCard.verifyTitleReads("The Unreadable Video");
  await library.unreadableCard.verifyKickerReads("Older format");
  await library.expectCardCountToBe(2);
});

test("opening it explains what happened and offers the video rather than a retry", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seedUnreadable(unreadableRecord());
  const library = await launcher.launchExpectingLibrary();

  await library.unreadableCard.open();

  const deadEnd = await launcher.errorState.verifyIsShown();
  await deadEnd.verifyTitleReads("This overview was saved in an older format");
  await deadEnd.verifyOffersAction("Watch on YouTube");
  await deadEnd.verifyOffersWayBack();
});

// A record from the future is the app's fault rather than the data's, and regenerating it
// would write this client's version over a newer one
// (docs/features/record-migrations.md).
test("a record from a newer version says so, and is not offered a way to overwrite it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seedUnreadable(
    unreadableRecord({ reason: "future-version", schemaVersion: 99 }),
  );
  const library = await launcher.launchExpectingLibrary();

  await library.unreadableCard.verifyKickerReads("Needs a newer version");
  await library.unreadableCard.open();

  const deadEnd = await launcher.errorState.verifyIsShown();
  await deadEnd.verifyTitleReads("This overview needs a newer version");
  await deadEnd.verifyOffersNoGenerateAgain();
});

test("a record with nothing left to salvage still appears, and offers only the way back", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seedUnreadable(unreadableRecord({ salvaged: null }));
  const library = await launcher.launchExpectingLibrary();

  await library.unreadableCard.verifyTitleReads("An overview you saved");
  await library.unreadableCard.open();

  const deadEnd = await launcher.errorState.verifyIsShown();
  await deadEnd.verifyOffersNoAction();
  await deadEnd.verifyOffersWayBack();
});
