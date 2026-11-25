import { OverviewId, SourceKey, VideoId, youTubeSource, type Capture } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { IWFT_VIDEO_ID, makeServiceTranscriptFixture } from "../../network/fixtures/innerTubeFixtures.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { Routes } from "../../../src/app/Routes.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { keptHereBannerTestIds } from "../../../src/features/captures/components/KeptHereBanner/KeptHereBannerTestIds.js";
import { keptLinksSectionTestIds } from "../../../src/features/captures/components/KeptLinksSection/KeptLinksSectionTestIds.js";
import { makeAllSavedTestIds } from "../../../src/features/captures/components/MakeAllSaved/MakeAllSavedTestIds.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const VALID_URL = `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`;
const EVENING = new Date("2026-10-06T21:30:00.000Z");
const CAP_RESETS_IN_SECONDS = 2.5 * 60 * 60;
const RESUME_TIME = new Date(EVENING.getTime() + CAP_RESETS_IN_SECONDS * 1000).toLocaleTimeString("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};

const propsOf = (backendSimulator: { analytics: { events: () => { name: string; props: unknown }[] } }, name: string) =>
  backendSimulator.analytics
    .events()
    .filter((event) => event.name === `keptLinks.${name}`)
    .map((event) => event.props);

const saved = (videoId: string, title: string, id: string): Capture => ({
  id: OverviewId.parse(id),
  sourceKey: SourceKey.parse(videoId),
  url: `https://www.youtube.com/watch?v=${videoId}`,
  keptAt: "2026-10-01T09:00:00.000Z",
  keptFrom: "phone",
  captureReason: null,
  title,
  thumbnailUrl: null,
  fromPlaylist: null,
  addedAt: null,
  playlistIndex: null,
  chosenAt: null,
  stage: "saved",
  source: youTubeSource({ ...makeOverview().source, id: VideoId.parse(videoId), url: `https://www.youtube.com/watch?v=${videoId}`, title }),
  savedAt: "2026-10-01T09:00:00.000Z",
  notes: null,
});

test("stopped at our server's cap, Keep it keeps the link, and it is made by itself once the server can fetch again", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.clock.install({ time: EVENING });
  backendSimulator.transcripts.serviceCapReached(CAP_RESETS_IN_SECONDS);
  await launcher.launch({ ...SIGNED_IN, apiKeys: ANTHROPIC_KEY });
  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.submitUrl(VALID_URL);

  await dialog.verifyKeepOffered(RESUME_TIME);
  await dialog.keepIt();
  await dialog.verifyKept(RESUME_TIME);
  const [kept] = await backendSimulator.captureStore.list();
  expect(kept).toMatchObject({ stage: "kept", waitingFor: "server", sourceKey: IWFT_VIDEO_ID });

  await launcher.openPage(Routes.queue());
  await expect(page.getByTestId(keptLinksSectionTestIds.server)).toContainText(`Continues after ${RESUME_TIME} · 1`);

  backendSimulator.transcripts.serviceAnswersAgain();
  await page.clock.fastForward(CAP_RESETS_IN_SECONDS * 1000 + 61_000);

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).map((overview) => overview.id)).toEqual([kept!.id]);
  expect(await backendSimulator.captureStore.list()).toEqual([]);
  await expect.poll(() => propsOf(backendSimulator, "queue.linkKept")).toEqual([{ plan: "free", surface: "web", waitingFor: "server" }]);
  await expect
    .poll(() => propsOf(backendSimulator, "queue.keptLinkMade"))
    .toEqual([{ plan: "free", surface: "web", keptFrom: "web", waitingFor: "server", waitedMinutes: 151, byExtension: false }]);
});

test("once overviews are back, Make all on No overview yet makes every saved one, one after another", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.captureStore.seed(saved(IWFT_VIDEO_ID, "The Simulated Video", "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d"));
  backendSimulator.captureStore.seed(saved("secondVideo1", "How Your Brain Fills In the Gaps", "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e"));
  backendSimulator.transcripts.seed(makeServiceTranscriptFixture(IWFT_VIDEO_ID, "The Simulated Video"));
  backendSimulator.transcripts.seed(makeServiceTranscriptFixture("secondVideo1", "How Your Brain Fills In the Gaps"));
  await launcher.launch(SIGNED_IN);
  await launcher.savedItem.showOnlyWithoutOverview();

  await page.getByTestId(makeAllSavedTestIds.button).click();

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(2);
  expect(await backendSimulator.captureStore.list()).toEqual([]);
});

test("the extension makes a link kept on a phone at once, and its panel says so while it does", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  const kept: Capture = {
    id: OverviewId.parse("3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f"),
    sourceKey: SourceKey.parse(IWFT_VIDEO_ID),
    url: VALID_URL,
    keptAt: "2026-10-06T20:00:00.000Z",
    keptFrom: "phone",
    captureReason: null,
    title: "The Simulated Video",
    thumbnailUrl: null,
    fromPlaylist: null,
    addedAt: null,
    playlistIndex: null,
    chosenAt: null,
    stage: "kept",
    source: null,
    waitingFor: "server",
    resumesAt: "2099-01-01T00:00:00.000Z",
    queueStatus: "waiting",
    problem: null,
  };
  backendSimulator.captureStore.seed(kept);
  backendSimulator.simulateEndpointStalled(EndpointKey.ANTHROPIC_MESSAGES);
  await launcher.launchPanel({ ...SIGNED_IN, apiKeys: ANTHROPIC_KEY, youTubeFetch: true });

  await expect(page.getByTestId(keptHereBannerTestIds.root)).toHaveText(
    "Making 1 link from your phone here. Keep this panel open until they’re done.",
  );
  await backendSimulator.releaseEndpoint(EndpointKey.ANTHROPIC_MESSAGES);

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).map((overview) => overview.id)).toEqual([kept.id]);
  await expect(page.getByTestId(keptHereBannerTestIds.root)).toHaveCount(0);
  await expect
    .poll(() => propsOf(backendSimulator, "queue.keptLinkMade"))
    .toMatchObject([{ surface: "panel", keptFrom: "phone", waitingFor: "server", byExtension: true }]);
});

test("a link already saved without an overview says so in Create, makes nothing, and opens the saved item", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.captureStore.seed(saved(IWFT_VIDEO_ID, "The Simulated Video", "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a"));
  await launcher.launch({ ...SIGNED_IN, apiKeys: ANTHROPIC_KEY });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);

  await dialog.verifyAlreadyHeld("Already saved · no overview yet. Open it");
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  await dialog.clickOpenHeld();
  await launcher.savedItem.verifyTitleIs("The Simulated Video");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "capture.newOverview.alreadyHeld"))
    .toMatchObject([{ props: { held: "saved" } }]);
});

test("a link already waiting in the queue says so in Create, makes nothing, and See queue opens the queue", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.captureStore.seed({
    id: OverviewId.parse("5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b"),
    sourceKey: SourceKey.parse(IWFT_VIDEO_ID),
    url: VALID_URL,
    keptAt: "2026-10-06T20:00:00.000Z",
    keptFrom: "phone",
    captureReason: null,
    title: "The Simulated Video",
    thumbnailUrl: null,
    fromPlaylist: null,
    addedAt: null,
    playlistIndex: null,
    chosenAt: null,
    stage: "kept",
    source: null,
    waitingFor: "server",
    resumesAt: "2099-01-01T00:00:00.000Z",
    queueStatus: "waiting",
    problem: null,
  });
  await launcher.launch({ ...SIGNED_IN, apiKeys: ANTHROPIC_KEY });
  const dialog = await launcher.appShell.openNewOverview();

  await dialog.form.submitUrl(VALID_URL);

  await dialog.verifyAlreadyHeld("Already in your queue. See queue");
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  await dialog.clickSeeQueue();
  await launcher.appShell.queuePage.verifyIsShown();
  await dialog.verifyIsHidden();
});

test("removing a kept link offers Undo, which puts it back, and it goes only once the Undo has passed", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.clock.install({ time: EVENING });
  backendSimulator.captureStore.seed({
    id: OverviewId.parse("6f7a8b9c-0d1e-4f2a-9b3c-4d5e6f7a8b9c"),
    sourceKey: SourceKey.parse(IWFT_VIDEO_ID),
    url: VALID_URL,
    keptAt: "2026-10-06T20:00:00.000Z",
    keptFrom: "phone",
    captureReason: null,
    title: "The Simulated Video",
    thumbnailUrl: null,
    fromPlaylist: null,
    addedAt: null,
    playlistIndex: null,
    chosenAt: null,
    stage: "kept",
    source: null,
    waitingFor: "server",
    resumesAt: "2099-01-01T00:00:00.000Z",
    queueStatus: "waiting",
    problem: null,
  });
  await launcher.launch(SIGNED_IN);
  await launcher.appShell.openQueue();
  const queue = await launcher.appShell.queuePage.verifyIsShown();
  await queue.verifyKeptLinks(["The Simulated Video"]);

  await queue.removeKeptLink("The Simulated Video");
  await queue.verifyRemovedSays("Removed “The Simulated Video”.");
  await queue.verifyKeptLinks([]);
  await queue.undoRemove();

  await queue.verifyKeptLinks(["The Simulated Video"]);
  expect(await backendSimulator.captureStore.list()).toHaveLength(1);

  await queue.removeKeptLink("The Simulated Video");
  await page.clock.fastForward(7_000);

  await expect.poll(() => backendSimulator.captureStore.list()).toEqual([]);
  await expect
    .poll(() => propsOf(backendSimulator, "queue.keptLinkRemoved"))
    .toEqual([{ plan: "free", surface: "web", waitingFor: "server" }]);
});
