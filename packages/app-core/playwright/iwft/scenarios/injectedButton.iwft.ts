import { VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/innerTubeFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const WATCHED_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const API_KEYS = ANTHROPIC_KEY;

const panel = { apiKeys: API_KEYS, activeVideoUrl: WATCHED_URL, runBridge: true, youTubeFetch: true };

test("pressing the button on the page starts the run, rather than only opening the panel", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const capture = await launcher.launchPanel(panel);

  await launcher.pressInjectedButton(WATCHED_URL);

  await capture.verifyIsWorking();
  await capture.verifyWorkingTitleReads("The Simulated Video");
});

test("a run started from the page is reported back to it, from running through to ready", async ({ launcher }) => {
  const capture = await launcher.launchPanel(panel);

  await launcher.pressInjectedButton(WATCHED_URL);
  await capture.waitForReader();

  await expect.poll(async () => (await launcher.readRunReports()).map((report) => report?.status ?? null)).toContain("ready");

  const reports = await launcher.readRunReports();
  expect(reports.filter((report) => report !== null).map((report) => report.videoUrl)).toContain(WATCHED_URL);
  // A button still saying "Creating" after the run is gone would report a run nobody has.
  expect(reports.at(-1)).toBeNull();
});

test("a press that arrives before our key has answered waits, rather than asking for a key", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.simulateEndpointStalled(EndpointKey.OUR_KEY_STATUS);
  const capture = await launcher.launchPanel({
    activeVideoUrl: WATCHED_URL,
    runBridge: true,
    youTubeFetch: true,
    sync: true,
    syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL, firstName: "Ada" },
  });

  await launcher.pressInjectedButton(WATCHED_URL);
  await capture.verifyIsShown();

  await backendSimulator.releaseEndpoint(EndpointKey.OUR_KEY_STATUS);

  await capture.waitForReader();
});

test("without keys the press goes to Settings rather than starting a run that cannot work", async ({ launcher, backendSimulator }) => {
  await launcher.launchPanel({ activeVideoUrl: WATCHED_URL, runBridge: true });

  await launcher.pressInjectedButton(WATCHED_URL);

  await launcher.settingsPage.verifySectionIsShown("keys");
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(0);

  expect(await launcher.readRunReports()).toEqual([null, null]);
});

test("signed out, the press goes to the panel's Start, whatever keys the device holds", async ({ launcher, backendSimulator }) => {
  await launcher.launchPanel({ ...panel, sync: true });

  await launcher.pressInjectedButton(WATCHED_URL);

  await launcher.homePage.verifyShowsStart();
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  expect(await launcher.readRunReports()).toEqual([null, null]);
});

test("pressing it on a video already in the library opens that note and buys nothing", async ({ launcher, backendSimulator }) => {
  const overview = makeOverview();
  backendSimulator.overviews.seed({
    ...overview,
    source: {
      ...overview.source,
      id: VideoId.parse(IWFT_VIDEO_ID),
      url: WATCHED_URL,
      title: "Held already",
    },
  });
  const capture = await launcher.launchPanel(panel);
  // Settled first: the panel prefetches the front video's captions, which a baseline would count.
  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(1);

  await launcher.pressInjectedButton(WATCHED_URL);

  const reader = await capture.waitForReader();
  await reader.verifyTitle("Held already");
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  expect(backendSimulator.getCallCount(EndpointKey.YOUTUBE_TIMEDTEXT)).toBe(1);
});

test("the web app, which has no page to be pressed from, reports nothing to anyone", async ({ launcher }) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "web" });

  expect(await launcher.readRunReports()).toEqual([]);
});

test("a press on the page and the panel it opens are counted, with what the press did", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  const capture = await launcher.launchPanel({
    ...panel,
    sync: true,
    syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL, firstName: "Ada" },
  });

  await launcher.pressInjectedButton(WATCHED_URL);
  await capture.verifyIsWorking();

  await expect
    .poll(() => backendSimulator.analytics.eventNames().filter((name) => name.startsWith("extension.")))
    .toEqual(["extension.sidePanel.opened", "extension.injectedButton.pressed"]);
  expect(backendSimulator.analytics.events().find(({ name }) => name === "extension.injectedButton.pressed")?.props).toEqual({
    outcome: "started",
  });
});
