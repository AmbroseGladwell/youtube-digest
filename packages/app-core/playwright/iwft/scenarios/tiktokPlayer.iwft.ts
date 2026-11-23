import { expect, test } from "../../support/fixtures.testHelper.js";
import { routeTikTokPlayer } from "../../network/fixtures/tiktokPlayerFixtures.js";
import { makeTikTokOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SHOTS = process.env.IWFT_SHOTS;
const PHONE = { width: 390, height: 844 };
const WIDE = { width: 1440, height: 900 };

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
    keyPoints: [
      { text: "The government wants every household to keep three days of food and water.", range: { startMs: 6_000, endMs: 20_000 } },
      { text: "It's guidance, not an instruction, and follows advice in Sweden and Finland.", range: { startMs: 24_000, endMs: 38_000 } },
      { text: "A basic kit is water, tinned food, a torch, a radio and batteries.", range: { startMs: 41_000, endMs: 56_000 } },
    ],
  };
};

test("on the web the player docks beside the note, and a time in the note opens it and seeks there", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize(WIDE);
  await routeTikTokPlayer(page);
  backendSimulator.overviews.seed(tiktokOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  const dock = page.getByRole("complementary", { name: "The TikTok" });
  await expect(dock.getByRole("button", { name: "Play the TikTok" })).toBeVisible();
  await expect(dock.getByRole("link", { name: "Watch on TikTok" })).toHaveAttribute("href", /tiktok\.com\/@kitchenwithada\/video\//);
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130g-docked-cover.png` });
  }

  await page.getByRole("button", { name: "Play the video from 0:24" }).click();

  const player = page.frameLocator('iframe[title^="TikTok video"]');
  await expect(player.locator("#heard")).toHaveText("seekTo:24 play");
  await expect(dock.getByTestId("TikTokPlayer.frame")).toBeVisible();
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130h-docked-playing.png` });
  }
});

test("when TikTok won't load its player, the note says so and its times open TikTok instead", async ({
  page,
  context,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize(WIDE);
  await routeTikTokPlayer(page, { failWith: 2001 });
  backendSimulator.overviews.seed(tiktokOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByRole("button", { name: "Play the TikTok" }).click();

  const failed = page.getByTestId("TikTokPlayer.failed");
  await expect(failed).toContainText("TikTok didn’t load the video here");
  await expect(failed.getByRole("link", { name: "Watch on TikTok" })).toBeVisible();
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130h-3-failed.png` });
  }
  const opened = context.waitForEvent("page");
  await page.getByRole("button", { name: "Play the video from 0:06" }).click();
  expect((await opened).url()).toMatch(/tiktok\.com\/@kitchenwithada\/video\//);
});

test("on a phone the player takes the head's place, and scrolled away while playing a slim bar stands in", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.setViewportSize(PHONE);
  await routeTikTokPlayer(page);
  backendSimulator.overviews.seed(tiktokOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  const stage = page.getByTestId("TikTokPlayer.root");
  await expect(page.getByRole("complementary", { name: "The TikTok" })).toHaveCount(0);
  const stageBox = await stage.boundingBox();
  const titleBox = await page.getByRole("heading", { name: "Why is the UK telling people to stockpile?" }).boundingBox();
  expect(stageBox!.y).toBeLessThan(titleBox!.y);

  await stage.getByRole("button", { name: "Play the TikTok" }).click();
  await expect(page.frameLocator('iframe[title^="TikTok video"]').locator("#heard")).toHaveText("play");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130g-p-phone-playing.png` });
  }

  await page.getByText("A basic kit is water").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 1200);
  const mini = page.getByTestId("TikTokPlayer.miniBar");
  await expect(mini).toBeVisible();
  await expect(mini.getByRole("button", { name: "Pause the TikTok" })).toBeVisible();
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130p-3-mini.png` });
  }
  await mini.getByRole("button", { name: "Back to the video" }).click();
  await expect(mini).toHaveCount(0);
});
