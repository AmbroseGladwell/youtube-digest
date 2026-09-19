import { test, expect } from "../../support/fixtures.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID } from "../../network/fixtures/supadataFixtures.js";

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

test("the web app, which has no page to be pressed from, reports nothing to anyone", async ({
  launcher,
}) => {
  await launcher.launch({ apiKeys: API_KEYS, surface: "web" });

  expect(await launcher.readRunReports()).toEqual([]);
});
