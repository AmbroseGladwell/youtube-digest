import { test, expect } from "../../support/fixtures.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";

const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };
const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;

const overviewPublished = (publishedAt: string | null) =>
  makeOverview({
    video: { ...makeOverview().video, title: "A dated video", publishedAt },
  });

test("the note says when the video went up, year and all", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(overviewPublished("2023-03-12T09:30:00.000Z"));

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.cardWithTitle("A dated video").openReaderFromTitle();

  await reader.verifyPublishedReads("· published 12 Mar 2023");
});

test("a note saved before the date was kept says nothing rather than guessing", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(overviewPublished(null));

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.cardWithTitle("A dated video").openReaderFromTitle();

  await reader.verifyShowsNoPublished();
});

// The real shape of an older note: the key is absent, not null. IndexedDB reads are not
// re-validated against the schema, so this is what actually comes back.
test("a note saved before the field existed at all still opens", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = overviewPublished(null);
  const video = { ...overview.video, durationMs: 842000 };
  delete (video as { publishedAt?: unknown }).publishedAt;
  delete (video as { durationMs?: unknown }).durationMs;
  backendSimulator.overviews.seed({ ...overview, video } as typeof overview);

  const library = await launcher.launchExpectingLibrary();
  const reader = await library.cardWithTitle("A dated video").openReaderFromTitle();

  await reader.verifyShowsNoPublished();
  await reader.verifyMetaReads("1 min read · 1 min listen");
});

test("a generated note keeps the date the source gave it", async ({ launcher, backendSimulator }) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  await form.submitUrl(VALID_URL);
  await launcher.appShell.newOverviewDialog.clickReadOverview();

  const reader = await launcher.readerPage.verifyIsShown();
  await reader.verifyIsShown();

  const [overview] = await backendSimulator.overviewStore.listOverviews();
  expect(overview?.video.publishedAt).not.toBeNull();
});
