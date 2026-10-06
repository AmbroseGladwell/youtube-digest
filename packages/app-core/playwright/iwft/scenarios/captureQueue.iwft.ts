import { PlaylistId, VideoId, type FollowedPlaylist, type QueuedCapture } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID, makeServiceTranscriptFixture } from "../../network/fixtures/innerTubeFixtures.js";
import { PSYCHOLOGY_ID, PSYCHOLOGY_URL, playlistEntry, psychologyPlaylist } from "../../network/fixtures/playlistFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const API_KEYS = { anthropicApiKey: "sk-ant-test" };
const ORIGIN = { id: PlaylistId.parse(PSYCHOLOGY_ID), title: "Psychology" };
const EVENING = new Date("2026-10-06T21:30:00.000Z");
const CAP_RESETS_IN_SECONDS = 2.5 * 60 * 60;
// Written in the runner's own clock, as the app writes it for the reader.
const RESUME_TIME = new Date(EVENING.getTime() + CAP_RESETS_IN_SECONDS * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const followed = (overrides: Partial<FollowedPlaylist> = {}): FollowedPlaylist => ({
  id: PlaylistId.parse(PSYCHOLOGY_ID),
  title: "Psychology",
  owner: "Veritasium",
  privacy: "public",
  followedAt: "2026-09-01T00:00:00.000Z",
  unavailable: null,
  ...overrides,
});

const queued = (videoId: string, title: string, overrides: Partial<QueuedCapture> = {}): QueuedCapture => ({
  videoId: VideoId.parse(videoId),
  url: `https://www.youtube.com/watch?v=${videoId}`,
  title,
  thumbnailUrl: null,
  fromPlaylist: ORIGIN,
  queuedAt: "2026-10-05T09:00:00.000Z",
  status: "waiting",
  problem: null,
  ...overrides,
});

// Following, with this device having already seen what the playlist held before.
const followingWithSeen = (backendSimulator: BackendSimulator, seen: string[]) => {
  backendSimulator.playlists.seedFollowed(followed());
  backendSimulator.playlists.seedCheck({
    playlistId: PlaylistId.parse(PSYCHOLOGY_ID),
    seenVideoIds: seen.map((id) => VideoId.parse(id)),
    checkedAt: "2026-10-04T09:00:00.000Z",
  });
};

test("on opening, a video added to a followed playlist is queued and made, and its overview says where it came from", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.playlists.seed(psychologyPlaylist());
  backendSimulator.transcripts.seedService(makeServiceTranscriptFixture("secondVideo1", "How Your Brain Fills In the Gaps"));
  followingWithSeen(backendSimulator, [IWFT_VIDEO_ID]);

  const home = await launcher.launch({ apiKeys: API_KEYS });

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(1);
  const [overview] = await backendSimulator.overviewStore.listOverviews();
  expect(overview?.video.id).toBe("secondVideo1");
  expect(overview?.fromPlaylist).toEqual(ORIGIN);
  const reader = await (await home.verifyShowsLibrary()).cardWithTitle("How Your Brain Fills In the Gaps").openReader();
  await reader.verifyFromLine("From Psychology playlist", true);
});

test("a playlist reordered by hand queues nothing it has already seen", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seed(
    psychologyPlaylist([
      playlistEntry("secondVideo1", "How Your Brain Fills In the Gaps", "2026-09-02T09:00:00.000Z"),
      playlistEntry(IWFT_VIDEO_ID, "The Simulated Video", "2026-09-01T09:00:00.000Z"),
    ]),
  );
  followingWithSeen(backendSimulator, [IWFT_VIDEO_ID, "secondVideo1"]);

  await launcher.launch({ apiKeys: API_KEYS });

  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.PLAYLIST_LOOKUP)).toBe(1);
  expect(await backendSimulator.playlists.listQueue()).toEqual([]);
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
});

test("a video with no captions fails, says why, and can be tried again or dismissed", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seedQueued(queued("noCaptions1", "Live Q&A: Ask Me Anything"));
  await launcher.launch({ apiKeys: API_KEYS });

  const strip = launcher.appShell.queueStrip;
  await strip.verifyReads("Queue done · 1 need attention", "1 failed");
  await strip.openQueue();
  const queue = await launcher.appShell.queuePage.verifyIsShown();
  await queue.verifyAttention([
    {
      tag: "Failed",
      title: "Live Q&A: Ask Me Anything",
      reason: "No captions, so there was nothing to read. Try again if the channel adds them. From Psychology.",
    },
  ]);

  await queue.retry("Live Q&A: Ask Me Anything");
  await expect.poll(() => backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(2);
  await queue.dismiss("Live Q&A: Ask Me Anything");

  await queue.verifyNothingWaiting();
  expect(await backendSimulator.playlists.listQueue()).toEqual([]);
});

test("a video tried again keeps its place and runs before what was already waiting", async ({ launcher, backendSimulator }) => {
  backendSimulator.transcripts.seedService(makeServiceTranscriptFixture("secondVideo1", "How Your Brain Fills In the Gaps"));
  backendSimulator.playlists.seedQueued(
    queued("noCaptions1", "Live Q&A: Ask Me Anything", { queuedAt: "2026-10-05T09:00:00.000Z", status: "failed", problem: "noCaptions" }),
  );
  backendSimulator.playlists.seedQueued(queued("secondVideo1", "How Your Brain Fills In the Gaps", { queuedAt: "2026-10-05T09:00:00.001Z" }));
  await launcher.launch({});
  await launcher.appShell.queueStrip.openQueue();
  const queue = await launcher.appShell.queuePage.verifyIsShown();
  await queue.verifyWaiting(["How Your Brain Fills In the Gaps"]);

  await queue.retry("Live Q&A: Ask Me Anything");

  await queue.verifyWaiting(["Live Q&A: Ask Me Anything", "How Your Brain Fills In the Gaps"]);
  await queue.verifyWaitingStatuses(["Waiting for an API key", "Waiting for an API key"]);
});

// The definition of done for OV-107: past our server's daily cap the queue waits visibly, with
// the reason and the resume time, offers no dead Try again, and carries on by itself after
// the reset (docs/features/capture-queue.md, "Waiting at a limit").
test("past our server's daily cap, the queue waits with the reason and resume time, and resumes by itself after the reset", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.clock.install({ time: EVENING });
  backendSimulator.transcripts.seedService(makeServiceTranscriptFixture("secondVideo1", "How Your Brain Fills In the Gaps"));
  backendSimulator.transcripts.serviceCapReached(CAP_RESETS_IN_SECONDS);
  backendSimulator.playlists.seedQueued(queued(IWFT_VIDEO_ID, "The Simulated Video"));
  backendSimulator.playlists.seedQueued(queued("secondVideo1", "How Your Brain Fills In the Gaps", { queuedAt: "2026-10-05T09:00:00.001Z" }));
  await launcher.launch({ apiKeys: API_KEYS });

  const strip = launcher.appShell.queueStrip;
  await strip.verifyReads("Waiting for our server", `2 waiting · these continue after ${RESUME_TIME}, or now with the extension`);
  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(1);
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  await strip.openQueue();
  const queue = await launcher.appShell.queuePage.verifyIsShown();
  await queue.verifyHeldNoteReads(
    `Our server has fetched as many transcripts for you as it can today. These continue after ${RESUME_TIME}, or now with the extension. Nothing has failed.`,
  );
  await queue.verifyWaiting(["The Simulated Video", "How Your Brain Fills In the Gaps"]);
  await queue.verifyWaitingStatuses([`Continues after ${RESUME_TIME}`, `Continues after ${RESUME_TIME}`]);
  await queue.verifyTryAgainIsOffered(false);
  await expect.poll(() =>
    backendSimulator.errors.batches().flatMap(({ warnings }) => warnings ?? []).filter(({ name }) => name === "captureQueueHeld"),
  ).toEqual([expect.objectContaining({ name: "captureQueueHeld", reason: "serverCap", waiting: 2, resumesInSeconds: CAP_RESETS_IN_SECONDS })]);

  backendSimulator.transcripts.serviceAnswersAgain();
  // The laptop lid closed for the evening and opened after the reset, rather than every
  // timer in between firing.
  await page.clock.fastForward(CAP_RESETS_IN_SECONDS * 1000);

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(2);
  await queue.verifyHeldNoteIsAbsent();
  await expect.poll(() =>
    backendSimulator.errors.batches().flatMap(({ warnings }) => warnings ?? []).filter(({ name }) => name === "captureQueueResumed"),
  ).toEqual([expect.objectContaining({ name: "captureQueueResumed", reason: "serverCap", via: "reset" })]);
});

test("a hold outlives reopening: the queue waits without asking our server again until the time has passed", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.clock.install({ time: EVENING });
  const hold = { reason: "serverCap", resumesAt: EVENING.getTime() + CAP_RESETS_IN_SECONDS * 1000 };
  await page.evaluate((stored) => localStorage.setItem("overview.captureQueue.noAccount", stored), JSON.stringify({ paused: false, folded: false, hold }));
  backendSimulator.playlists.seedQueued(queued(IWFT_VIDEO_ID, "The Simulated Video"));
  await launcher.launch({ apiKeys: API_KEYS });

  await launcher.appShell.queueStrip.verifyReads("Waiting for our server", `1 waiting · it continues after ${RESUME_TIME}, or now with the extension`);
  expect(backendSimulator.getCallCount(EndpointKey.SERVICE_TRANSCRIPT)).toBe(0);

  await page.clock.fastForward(CAP_RESETS_IN_SECONDS * 1000);

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(1);
});

test("asked to slow down, the queue waits a moment and carries on, rather than failing the video", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.clock.install({ time: EVENING });
  backendSimulator.transcripts.serviceBusy(45);
  backendSimulator.playlists.seedQueued(queued(IWFT_VIDEO_ID, "The Simulated Video"));
  await launcher.launch({ apiKeys: API_KEYS });

  const resumeTime = new Date(EVENING.getTime() + 45_000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const strip = launcher.appShell.queueStrip;
  await strip.verifyReads("Waiting for our server", `1 waiting · it asked us to slow down · it continues after ${resumeTime}`);
  await strip.openQueue();
  const queue = await launcher.appShell.queuePage.verifyIsShown();
  await queue.verifyHeldNoteReads(`Our server asked us to slow down for a moment. The waiting video continues after ${resumeTime}. Nothing has failed.`);
  await queue.verifyTryAgainIsOffered(false);

  backendSimulator.transcripts.serviceAnswersAgain();
  await page.clock.runFor(45_000);

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(1);
  await expect.poll(() =>
    backendSimulator.errors.batches().flatMap(({ warnings }) => warnings ?? []).filter(({ name }) => name === "captureQueueHeld"),
  ).toEqual([expect.objectContaining({ name: "captureQueueHeld", reason: "serverBusy", waiting: 1, resumesInSeconds: 45 })]);
});

test("a backfill queues private and deleted videos as skipped, saying so", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seed(
    psychologyPlaylist([
      playlistEntry(IWFT_VIDEO_ID, "The Simulated Video", "2026-09-01T09:00:00.000Z"),
      playlistEntry("private0001", "Private video", "2026-09-02T09:00:00.000Z", { availability: "private" }),
    ]),
  );
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  await form.pasteUrl(PSYCHOLOGY_URL);
  await launcher.appShell.playlistFlow.verifyPreview({
    title: "Psychology",
    owner: "Veritasium · Public",
    facts: ["2 videos in the playlist", "1 private or deleted, so it’s skipped", "1 to make, oldest first"],
    estimate: "About 30,000 tokens on your own API key",
    basis: "Estimate: 30,000 tokens per overview × 1",
  });
  await launcher.appShell.playlistFlow.followWithBackfill();

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(1);
  await launcher.appShell.queueStrip.openQueue();
  const queue = await launcher.appShell.queuePage.verifyIsShown();
  await queue.verifyAttention([
    { tag: "Skipped", title: "Private video", reason: "Made private on YouTube, so we can’t read it. From Psychology." },
  ]);
});

test("without an API key, the queue waits and says so rather than seeming to work", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seedQueued(queued(IWFT_VIDEO_ID, "The Simulated Video"));
  backendSimulator.playlists.seedQueued(queued("secondVideo1", "How Your Brain Fills In the Gaps", { queuedAt: "2026-10-05T09:00:00.001Z" }));
  await launcher.launch({});

  const strip = launcher.appShell.queueStrip;
  await strip.verifyReads("2 videos are waiting for an API key", "Nothing can be made without one");
  await strip.openQueue();
  const queue = await launcher.appShell.queuePage.verifyIsShown();
  await queue.verifyNoKeyNote();
  await queue.verifyPauseIsOffered(false);
  await queue.verifyWaiting(["The Simulated Video", "How Your Brain Fills In the Gaps"]);
  await queue.verifyWaitingStatuses(["Waiting for an API key", "Waiting for an API key"]);
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
});

test("pausing keeps the video unmade at the top of the queue until the reader resumes", async ({ launcher, backendSimulator }) => {
  backendSimulator.simulateEndpointStalled(EndpointKey.SERVICE_TRANSCRIPT);
  backendSimulator.playlists.seedQueued(queued(IWFT_VIDEO_ID, "The Simulated Video"));
  await launcher.launch({ apiKeys: API_KEYS });

  const strip = launcher.appShell.queueStrip;
  await strip.verifyReads("Making 1 of 1", "Fetching the transcript · The Simulated Video");
  await strip.pause();
  await backendSimulator.releaseEndpoint(EndpointKey.SERVICE_TRANSCRIPT);
  await strip.verifyReads("Queue paused", "1 waiting · nothing is made until you resume");
  expect(await backendSimulator.overviewStore.listOverviews()).toEqual([]);

  await strip.resume();
  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(1);
  await strip.verifyReads("Queue done · 1 made");
});

test("clearing the queue removes what waits and leaves the playlists followed", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seedFollowed(followed());
  backendSimulator.playlists.seedQueued(queued(IWFT_VIDEO_ID, "The Simulated Video"));
  await launcher.launch({});
  await launcher.appShell.queueStrip.openQueue();

  const queue = await launcher.appShell.queuePage.verifyIsShown();
  await queue.clear();

  await queue.verifyNothingWaiting();
  expect(await backendSimulator.playlists.listFollowed()).toHaveLength(1);
});

test("an overview from a playlist no longer followed keeps its From line, without Manage", async ({ launcher, backendSimulator }) => {
  backendSimulator.overviews.seed(makeOverview({ fromPlaylist: { id: PlaylistId.parse("PLkitchen"), title: "Kitchen basics" } }));
  const home = await launcher.launch({});

  const library = await home.verifyShowsLibrary();
  const reader = await library.cardWithTitle("Example").openReader();

  await reader.verifyFromLine("From Kitchen basics playlist", false);
});

test("a followed playlist gone from YouTube says so on the overviews made from it", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seedFollowed(followed({ unavailable: "gone" }));
  backendSimulator.playlists.seedCheck({ playlistId: PlaylistId.parse(PSYCHOLOGY_ID), seenVideoIds: [], checkedAt: "2026-10-04T09:00:00.000Z" });
  backendSimulator.overviews.seed(makeOverview({ fromPlaylist: ORIGIN }));
  const home = await launcher.launch({});

  const reader = await (await home.verifyShowsLibrary()).cardWithTitle("Example").openReader();

  await reader.verifyFromLine("From Psychology playlist · no longer on YouTube", false);
});
