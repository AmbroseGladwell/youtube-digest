import { expect } from "@playwright/test";
import { VideoId } from "@overview/domain";
import { test } from "../../support/fixtures.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";
import { makeRecipeVideoOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { makeStoredTranscript } from "../../../src/features/transcripts/types/StoredTranscriptFactory.testHelper.js";
import { makeCaptionRun } from "../../../src/features/transcripts/types/TranscriptSegmentFactory.testHelper.js";

const VIDEO_ID = VideoId.parse("example");
const VIDEO_URL = "https://www.youtube.com/watch?v=example";

const transcript = () =>
  makeStoredTranscript({
    videoId: VIDEO_ID,
    segments: [
      ...makeCaptionRun(["Today it's party jollof."], { startMs: 0 }),
      ...makeCaptionRun(["Blend the tomatoes and peppers."], { startMs: 65_000 }),
      ...makeCaptionRun(["Now fry the base until the oil floats."], { startMs: 252_000 }),
      ...makeCaptionRun(["Taste it, and that's it."], { startMs: 400_000 }),
    ],
  });

test("a recipe video's note is the recipe with the video's tabs, and its steps carry their moments", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeRecipeVideoOverview());
  const library = await launcher.launchExpectingLibrary();
  await expect(page.getByText(/14:32 recipe video/)).toBeVisible();

  await library.nthCard(0).openReader();

  await expect(page.getByText("Kitchen with Ada · Recipe video")).toBeVisible();
  await expect(page.getByRole("tab")).toHaveText(["Overview", "Transcript", "Chapters"]);
  await expect(page.getByText("As the video’s description gives them.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open the video on YouTube · 14:32/ })).toHaveAttribute("href", VIDEO_URL);
  await expect(page.getByTestId("RecipeIngredients.source")).toHaveText("From the video’s description, with 1 said in the video.");
  await expect(page.getByTestId("RecipeIngredients.line").nth(3)).toHaveText("Fried plantain, to serve· said in the video");
  await expect(page.getByTestId("RecipeMethod.root").getByTestId("LineRangeTag.tag")).toHaveText(["1:05", "4:12"]);
  await expect(page.getByRole("button", { name: "Step 2 at 4:12: watch or read the transcript" })).toBeVisible();
  await expect(page.getByText("Verdict")).toHaveCount(0);
  await expect(page.getByText("Key points")).toHaveCount(0);
});

test("a step's moment opens the transcript at the line it starts, named for the step", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeRecipeVideoOverview());
  backendSimulator.transcripts.seed(transcript());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByRole("button", { name: "Step 2 at 4:12: watch or read the transcript" }).click();
  await expect(page.getByTestId("LineRangeTag.watchLink")).toHaveAttribute("href", `${VIDEO_URL}&t=252`);
  await page.getByTestId("LineRangeTag.transcriptButton").click();

  await expect(page.getByTestId("TranscriptPanel.stepChip")).toHaveText("Step 2 starts here");
});

test("each chapter names the steps it covers, and one that holds none says nothing about steps", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeRecipeVideoOverview());
  backendSimulator.transcripts.seed(transcript());
  const library = await launcher.launchExpectingLibrary();
  const reader = await library.nthCard(0).openReader();
  await reader.clickTab("Chapters");

  await expect(page.getByTestId("ChaptersPanel.steps")).toHaveText([" · Steps 1–2"]);
});

test("a recipe video with no chapters has only the Overview and Transcript tabs", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeRecipeVideoOverview({ chapters: [] }));
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await expect(page.getByRole("tab")).toHaveText(["Overview", "Transcript"]);
});

test("in the panel the step the video is in is tinted, and its time says it's playing", async ({ page, launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeRecipeVideoOverview());
  const capture = await launcher.launchPanel({
    apiKeys: ANTHROPIC_KEY,
    activeVideoUrl: VIDEO_URL,
    playback: { videoId: VIDEO_ID, positionMs: 260_000, playing: true },
  });
  await capture.openStoredOverview();

  const playing = page.locator('[aria-current="step"]');
  await expect(playing).toContainText("Fry the base");
  await expect(playing.getByTestId("LineRangeTag.tag")).toHaveText("4:12 · Playing");

  await launcher.movePlaybackTo({ videoId: VIDEO_ID, positionMs: 70_000, playing: true });
  await expect(page.locator('[aria-current="step"]')).toContainText("Blend the tomatoes");
});

test("cooking a recipe video offers each step's part of the video, and a step with no moment offers none", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.overviews.seed(makeRecipeVideoOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("RecipeMethod.cook").click();
  const mode = page.getByTestId("CookingMode.root");
  await expect(mode.getByTestId("CookingMode.watchStep")).toHaveText("Watch this step · 1:05");
  await mode.getByTestId("CookingMode.watchStep").click();
  await expect(page.getByTestId("CookingStepVideoSheet.player")).toHaveAttribute(
    "src",
    "https://www.youtube-nocookie.com/embed/example?start=65&end=130&autoplay=1&rel=0",
  );
  await page.getByTestId("CookingStepVideoSheet.close").click();

  await mode.getByTestId("CookingMode.forward").click();
  await mode.getByTestId("CookingMode.forward").click();
  await expect(mode.getByTestId("CookingMode.place")).toHaveText("Step 3");
  await expect(mode.getByTestId("CookingMode.watchStep")).toHaveCount(0);
});

test("copying a recipe video names the channel on YouTube and ends each step with its moment", async ({
  page,
  context,
  launcher,
  backendSimulator,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  backendSimulator.overviews.seed(makeRecipeVideoOverview());
  const library = await launcher.launchExpectingLibrary();
  await library.nthCard(0).openReader();

  await page.getByTestId("OverviewActionsMenu.trigger").click();
  await page.getByTestId("OverviewActionsMenu.copyRecipeItem").click();

  await expect(page.getByRole("status").filter({ hasText: "Recipe copied, with a link to the video" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain(`From Kitchen with Ada on YouTube: ${VIDEO_URL}`);
  expect(copied).toContain("2. Fry the base until the oil rises to the top. (4:12)");
});
