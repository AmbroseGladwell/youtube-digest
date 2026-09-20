import { VideoId } from "@overview/types";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const WATCHED_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = { anthropicApiKey: "sk-ant-test", supadataApiKey: "sd-test" };

const panel = { apiKeys: API_KEYS, activeVideoUrl: WATCHED_URL, runBridge: true };

test("pressing the button on the page starts the run, rather than only opening the panel", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const capture = await launcher.launchPanel(panel);

  await launcher.pressInjectedButton(WATCHED_URL);

  await capture.verifyIsWorking();
  await capture.verifyWorkingTitleReads("The Simulated Video");
});

test("a run started from the page is reported back to it, from running through to ready", async ({
  launcher,
}) => {
  const capture = await launcher.launchPanel(panel);

  await launcher.pressInjectedButton(WATCHED_URL);
  await capture.waitForReader();

  await expect
    .poll(async () => (await launcher.readRunReports()).map((report) => report?.status ?? null))
    .toContain("ready");

  const reports = await launcher.readRunReports();
  expect(reports.filter((report) => report !== null).map((report) => report.videoUrl)).toContain(
    WATCHED_URL,
  );
  // The run is dismissed as the panel opens the note, and the page is told so: a button
  // still saying "Creating" after the run is gone would be reporting a run nobody has.
  expect(reports.at(-1)).toBeNull();
});

// Design 17d: the press cannot spend anything without the keys that would pay for it,
// so it lands on the page that fixes that instead of failing.
test("without keys the press goes to Settings rather than starting a run that cannot work", async ({
  launcher,
  backendSimulator,
}) => {
  await launcher.launchPanel({ activeVideoUrl: WATCHED_URL, runBridge: true });

  await launcher.pressInjectedButton(WATCHED_URL);

  await launcher.settingsPage.verifyIsShown();
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(0);

  // The page has to be told, or the button it drew on the press keeps claiming a run
  // that was never started.
  expect(await launcher.readRunReports()).toEqual([null, null]);
});

// The button reads "Overview ready" on a video already written up, and pressing it has
// to open that note. Starting a second run would make the page's own control the one
// place in the app that pays for the same video twice.
test("pressing it on a video already in the library opens that note and buys nothing", async ({
  launcher,
  backendSimulator,
}) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    video: {
      ...overview.video,
      id: VideoId.parse(IWFT_VIDEO_ID),
      url: WATCHED_URL,
      title: "Held already",
    },
  });
  const capture = await launcher.launchPanel(panel);
  // Settled before the press, not sampled beside it: the panel buys the captions of the
  // video in front of it on its own (docs/features/watching-detection.md), and a
  // baseline read while that is still in flight counts the prefetch as the press's
  // spend. What the press must add is nothing.
  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(1);

  await launcher.pressInjectedButton(WATCHED_URL);

  const reader = await capture.waitForReader();
  await reader.verifyTitle("Held already");
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.SUPADATA_TRANSCRIPT)).toBe(1);
});

test("the web app, which has no page to be pressed from, reports nothing to anyone", async ({
  launcher,
}) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "web" });

  expect(await launcher.readRunReports()).toEqual([]);
});
