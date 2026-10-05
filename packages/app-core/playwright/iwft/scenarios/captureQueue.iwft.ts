import { PlaylistId, VideoId, type FollowedPlaylist, type QueuedCapture } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID, makeServiceTranscriptFixture } from "../../network/fixtures/innerTubeFixtures.js";
import { PSYCHOLOGY_ID, PSYCHOLOGY_URL, playlistEntry, psychologyPlaylist } from "../../network/fixtures/playlistFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";

const API_KEYS = { anthropicApiKey: "sk-ant-test" };
const ORIGIN = { id: PlaylistId.parse(PSYCHOLOGY_ID), title: "Psychology" };

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
