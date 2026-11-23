import { ShareToken, VideoId, shareSnapshot, type SharePayload } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { routeTikTokPlayer } from "../../network/fixtures/tiktokPlayerFixtures.js";
import { Routes } from "../../../src/app/Routes.js";
import { makeTikTokOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SHOTS = process.env.IWFT_SHOTS;
const TOKEN = ShareToken.parse("k7Qm2x9RfTtiktok");
const SERVER = "https://sync.test";
const WIDE = { width: 1440, height: 900 };

const payload = (): SharePayload => {
  const overview = makeTikTokOverview();
  return {
    state: "shared",
    token: TOKEN,
    sharedAt: "2026-11-20T11:00:00.000Z",
    snapshot: shareSnapshot({
      overview: {
        ...overview,
        source: {
          kind: "tiktok",
          id: VideoId.parse("7438291055512345678"),
          url: "https://www.tiktok.com/@bbcnews/video/7438291055512345678",
          title: "Why is the UK telling people to stockpile?",
          handle: "bbcnews",
          authorName: "BBC News",
          durationMs: 58_000,
          publishedAt: "2026-11-12T18:30:00.000Z",
          imageUrl: null,
        },
        keyPoints: [
          { text: "The government wants every household to keep three days of supplies.", range: { startMs: 6_000, endMs: 20_000 } },
          { text: "It's guidance, not an instruction.", range: { startMs: 24_000, endMs: 38_000 } },
          { text: "A basic kit is water, tinned food, a torch and a radio.", range: { startMs: 41_000, endMs: 56_000 } },
        ],
      },
      narration: null,
    }),
  };
};

test("signed out, a shared TikTok has its player above the title and the promo beside, which sells the free account", async ({
  page,
  launcher,
}) => {
  await page.setViewportSize(WIDE);
  await routeTikTokPlayer(page);
  await launcher.launch({ sync: true, defaultApiUrl: SERVER });
  await launcher.inlineSharePayload(payload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  await launcher.sharedOverviewPage.verifyIsShown();

  await expect(page.getByTestId("SharedOverviewPage.kindChip")).toHaveText("TikTok");
  const player = await page.getByTestId("TikTokPlayer.root").boundingBox();
  const title = await page.getByRole("heading", { level: 1 }).boundingBox();
  expect(player!.y).toBeLessThan(title!.y);
  const promo = page.getByRole("complementary", { name: "Make your own overviews" });
  await expect(promo.getByText("Save what you care about, get an overview plus personalised actions")).toBeVisible();
  await expect(promo.getByRole("button", { name: "Make my overview" })).toBeVisible();
  await expect(promo.getByText("No card needed. Free includes 5 overviews a month.")).toBeVisible();
  await expect(promo.getByText("What you get")).toBeVisible();
  await expect(promo.getByText("Plus", { exact: true })).toHaveCount(0);
  await expect(promo.getByLabel("Link to a video, page or episode")).toBeVisible();
  await expect(page.getByRole("link", { name: "Watch on TikTok" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Play the video from 0:24" }).click();
  await expect(page.frameLocator('iframe[title^="TikTok video"]').locator("#heard")).toHaveText("seekTo:24 play");
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130q-signed-out.png`, fullPage: true });
  }
});

test("signed in without a saved copy, there's no promo and the player docks beside the note", async ({ page, launcher }) => {
  await page.setViewportSize(WIDE);
  await routeTikTokPlayer(page);
  await launcher.launch({
    sync: true,
    syncConnection: { apiUrl: SERVER, token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL, firstName: "Ada" },
    defaultApiUrl: SERVER,
  });
  await launcher.inlineSharePayload(payload());
  await launcher.openPage(Routes.sharedOverview(TOKEN));
  await launcher.sharedOverviewPage.verifyIsShown();

  await expect(page.getByRole("complementary", { name: "Make your own overviews" })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "The TikTok" }).getByRole("button", { name: "Play the TikTok" })).toBeVisible();
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/130q-2-signed-in.png` });
  }
});
