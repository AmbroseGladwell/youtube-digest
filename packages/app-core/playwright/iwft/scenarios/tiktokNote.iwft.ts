import { expect, test } from "../../support/fixtures.testHelper.js";
import { makeTikTokOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SHOTS = process.env.IWFT_SHOTS;

// A 9:16 cover drawn in place, so the test reaches no network.
const PORTRAIT_COVER = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="270" height="480"><rect width="270" height="480" fill="#2b3a46"/></svg>',
)}`;

const tiktokOverview = () => {
  const overview = makeTikTokOverview();
  return {
    ...overview,
    source: {
      ...overview.source,
      title: "Why is the UK telling people to stockpile?",
      authorName: "BBC News",
      handle: "bbcnews",
      durationMs: 58_000,
      imageUrl: PORTRAIT_COVER,
    },
  };
};

test("a TikTok's library row mattes its portrait cover, leads with its chip and gives its length in seconds", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(tiktokOverview());
  await launcher.launchExpectingLibrary();

  const row = page.getByRole("article").first();
  await expect(row.getByText("TikTok", { exact: true })).toBeVisible();
  await expect(row.getByText(/58 s video/)).toBeVisible();
  const cover = row.getByTestId("OverviewThumbnail.image");
  const box = await cover.boundingBox();
  expect(box!.height / box!.width).toBeCloseTo(16 / 9, 1);
  if (SHOTS) {
    await row.screenshot({ path: `${SHOTS}/130j-row.png` });
  }
});

test("a TikTok's note shows the caption as its title, the creator with their handle, no Chapters tab and its matted cover to play", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(tiktokOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await expect(page.getByRole("heading", { name: "Why is the UK telling people to stockpile?" })).toBeVisible();
  await expect(page.getByTestId("ReaderMasthead.channel")).toHaveText("BBC News @bbcnews");
  await expect(page.getByRole("tab")).toHaveText(["Overview", "Transcript"]);
  await expect(page.getByTestId("ReaderMasthead.meta")).toContainText("58 s video");
  const cover = page.getByTestId("TikTokPlayer.cover").locator("img");
  const box = await cover.boundingBox();
  expect(box!.height / box!.width).toBeCloseTo(16 / 9, 1);
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130g-note.png` });
  }
});
