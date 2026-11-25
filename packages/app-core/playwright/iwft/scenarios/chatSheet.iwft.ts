import { VideoId, type FollowUpQuestion, type Overview } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const PHONE = { width: 390, height: 800 };
const VIDEO_ID = "creatineVideo";
const VIDEO_URL = `https://www.youtube.com/watch?v=${VIDEO_ID}`;
const QUESTIONS: FollowUpQuestion[] = [{ question: "How much extra lean mass did people gain?", forReader: false }];

const creatine = (): Overview => {
  const overview = makeOverview({
    followUpQuestions: QUESTIONS,
    keyPoints: [{ text: "Taken with strength training, creatine adds a little lean mass.", range: { startMs: 208_000, endMs: 263_000 } }],
  });
  return { ...overview, source: { ...overview.source, title: "Creatine, debunked", id: VideoId.parse(VIDEO_ID), url: VIDEO_URL } };
};

test.describe("Chat as a sheet", () => {
  test("on a phone a question opens chat as a sheet that holds focus, and its handle lowers it to its header and back", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    await page.setViewportSize(PHONE);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.verifyLineReads("Tap one and it’s answered here, from the video. Change");

    await reader.followUps.clickQuestion(0);

    await reader.chat.verifySheetIs("raised");
    await reader.chat.verifyAnswersRead([
      "People who took creatine while strength training gained more lean mass than people who trained without it.",
    ]);
    await reader.chat.verifyFieldIsFocused();

    await reader.chat.clickHandle();

    await reader.chat.verifySheetIs("lowered");
    await reader.chat.verifyLoweredReads(QUESTIONS[0]!.question, "About Creatine, debunked", "Raise chat");
    await reader.chat.raiseFromLowered();
    await reader.chat.verifySheetIs("raised");
  });

  test("closing chat lets the sheet fall away like every other sheet, and then it's gone", async ({ launcher, backendSimulator, page }) => {
    backendSimulator.overviews.seedSynced(creatine());
    await page.setViewportSize(PHONE);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.clickQuestion(0);
    await reader.chat.verifySheetIs("raised");

    await reader.chat.close();

    await reader.chat.verifySheetFallsAway();
  });

  test("dragging the handle past halfway lowers the sheet, and dragging it back up raises it", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    await page.setViewportSize(PHONE);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.openFromMenu();

    await reader.chat.dragHandle(500, 20);

    await reader.chat.verifySheetIs("lowered");

    await reader.chat.dragHandle(-500, 20);

    await reader.chat.verifySheetIs("raised");
  });

  test("on a phone, reading a cited stretch in the transcript lowers the sheet to say so", async ({ launcher, backendSimulator, page }) => {
    backendSimulator.overviews.seedSynced(creatine());
    await page.setViewportSize(PHONE);
    const library = await launcher.launchExpectingLibrary(SIGNED_IN);
    const reader = await library.nthCard(0).openReader();
    await reader.chat.askInNote("How much lean mass?");
    await reader.chat.followCitation(0, 0);

    await reader.chat.readCitedInTranscript();

    await reader.chat.verifySheetIs("lowered");
    await reader.chat.verifyLoweredReads("How much lean mass?", "Reading the transcript from 3:28", "Back to the conversation");
  });

  test("in the extension's panel, a cited stretch plays the video beside it and the sheet lowers to say what's playing", async ({
    launcher,
    backendSimulator,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    const capture = await launcher.launchPanel({
      ...SIGNED_IN,
      activeVideoUrl: VIDEO_URL,
      playback: { videoId: VIDEO_ID, positionMs: 0, playing: true },
    });
    const reader = await capture.openStoredOverview();
    await reader.chat.askInNote("How much lean mass?");
    await reader.chat.verifySheetIs("raised");

    await reader.chat.followCitation(0, 0);

    await expect.poll(() => launcher.readPlaybackSeeks()).toEqual([208_000]);
    await reader.chat.verifySheetIs("lowered");
    await reader.chat.verifyLoweredReads("How much lean mass?", "Playing 3:28–4:23 from the answer", "Back to the conversation");
    await reader.chat.verifyNoteLineCited("Taken with strength training");
  });

  test("on a phone, the header's ⋯ opens as an action sheet, and Escape returns to the chat", async ({
    launcher,
    backendSimulator,
    page,
  }) => {
    backendSimulator.overviews.seedSynced(creatine());
    await page.setViewportSize(PHONE);
    const library = await launcher.launchExpectingLibrary({ ...SIGNED_IN, followUpAssistant: "claude" });
    const reader = await library.nthCard(0).openReader();
    await reader.followUps.clickQuestion(0);
    await reader.chat.verifySheetIs("raised");
    await reader.chat.verifyCopyUnderAnswers(1);

    await reader.chat.openMenu();

    await reader.chat.verifyMenuIsInASheet();
    await reader.chat.verifyMenuOffers(["Continue in Claude (opens in a new tab)"]);

    await reader.chat.pressEscape();

    await reader.chat.verifyMenuIsClosed();
    await reader.chat.verifySheetIs("raised");
  });
});
