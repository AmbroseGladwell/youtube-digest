import { PlaylistId, VideoId, type FollowedPlaylist, type PlaylistPace, type QueuedCapture } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { makeServiceTranscriptFixture } from "../../network/fixtures/innerTubeFixtures.js";
import { PSYCHOLOGY_ID, PSYCHOLOGY_URL, playlistEntry, psychologyPlaylist } from "../../network/fixtures/playlistFixtures.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

// The queue at the month's limit waits rather than failing, says why and when it carries on,
// and the preview and Choose say what the allowance left means before anything runs
// (designs 95p–95s, 95v, 95ad, 95ah; docs/features/capture-queue.md, "Waiting at a limit").
const SIGNED_IN_WITHOUT_A_KEY = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL },
};
const SIGNED_IN = { ...SIGNED_IN_WITHOUT_A_KEY, apiKeys: ANTHROPIC_KEY };
const PSYCHOLOGY = { id: PlaylistId.parse(PSYCHOLOGY_ID), title: "Psychology" };
const LAST_EVENING_OF_OCTOBER = new Date("2026-10-31T22:00:00.000Z");

const VIDEOS = [
  { id: "limitVideo1", title: "Why We Can't Remember Being Babies" },
  { id: "limitVideo2", title: "How Sleep Cleans the Brain" },
  { id: "limitVideo3", title: "The Placebo Paradox" },
] as const;

const queued = (index: number): QueuedCapture => ({
  videoId: VideoId.parse(VIDEOS[index]!.id),
  url: `https://www.youtube.com/watch?v=${VIDEOS[index]!.id}`,
  title: VIDEOS[index]!.title,
  thumbnailUrl: null,
  fromPlaylist: PSYCHOLOGY,
  queuedAt: `2026-10-05T09:00:00.00${index}Z`,
  status: "waiting",
  problem: null,
  chosenAt: null,
});

const followingAt = (backendSimulator: BackendSimulator, pace: PlaylistPace, captures: QueuedCapture[]) => {
  const followed: FollowedPlaylist = {
    ...PSYCHOLOGY,
    owner: "Veritasium",
    privacy: "public",
    followedAt: "2026-09-01T00:00:00.000Z",
    unavailable: null,
    pace,
  };
  backendSimulator.playlists.seed(psychologyPlaylist());
  backendSimulator.playlists.seedFollowed(followed);
  backendSimulator.playlists.seedCheck({
    playlistId: PSYCHOLOGY.id,
    seenVideoIds: psychologyPlaylist().entries.map((entry) => entry.videoId),
    checkedAt: "2026-10-04T09:00:00.000Z",
  });
  for (const capture of captures) {
    backendSimulator.transcripts.seedService(makeServiceTranscriptFixture(capture.videoId, capture.title));
    backendSimulator.playlists.seedQueued(capture);
  }
};

const warnings = (backendSimulator: BackendSimulator, name: string) =>
  backendSimulator.errors.batches().flatMap(({ warnings }) => warnings ?? []).filter((warning) => warning.name === name);

const overviewCount = async (backendSimulator: BackendSimulator) => (await backendSimulator.overviewStore.listOverviews()).length;

test("on Free with no key and our key's 5 spent, the queue waits for the month, says why, and asks nothing", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  followingAt(backendSimulator, "asTheyCome", [queued(0), queued(1)]);
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);

  const strip = launcher.appShell.queueStrip;
  await strip.verifyReads("Queue waiting · 2 videos", "This month's 5 are made. Resumes 1 November, or when you add a key.");
  await strip.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();
  await queuePage.verifyMonthHeldNote(
    "This month's 5 are made, so the queue is waiting. It carries on by itself on 1 November, as soon as you add a key or if your plan changes.",
    ["Add a key", "See plans"],
  );
  await queuePage.verifyWaitingLabel("Waiting · 2 · resumes 1 November");
  await queuePage.verifyWaitingStatuses(["Waiting for 1 November", "Waiting for 1 November"]);
  await queuePage.verifyPauseIsOffered(false);
  await queuePage.verifyTryAgainIsOffered(false);
  expect(backendSimulator.ourKey.generations()).toHaveLength(0);
  await expect
    .poll(() => warnings(backendSimulator, "captureQueueHeld"))
    .toEqual([expect.objectContaining({ name: "captureQueueHeld", reason: "monthSpent", waiting: 2 })]);
});

test("a key added at the month's limit starts the queue again at once", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  followingAt(backendSimulator, "asTheyCome", [queued(0)]);
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  await launcher.appShell.queueStrip.verifyReads("Queue waiting · 1 video", "This month's 5 are made. Resumes 1 November, or when you add a key.");

  const settings = await (await launcher.appShell.openSettings()).openSection("keys");
  await settings.apiKeysPanel.addKey("anthropic", "sk-ant-api03-simulated-key-for-the-limit");

  await expect.poll(() => overviewCount(backendSimulator)).toBe(1);
  await expect
    .poll(() => warnings(backendSimulator, "captureQueueResumed"))
    .toEqual([expect.objectContaining({ name: "captureQueueResumed", reason: "monthSpent", via: "key" })]);
});

test("as the month turns, the queue asks for the counts again and carries on", async ({ page, launcher, backendSimulator }) => {
  await page.clock.install({ time: LAST_EVENING_OF_OCTOBER });
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  followingAt(backendSimulator, "asTheyCome", [queued(0)]);
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  await launcher.appShell.queueStrip.verifyReads("Queue waiting · 1 video", "This month's 5 are made. Resumes 1 November, or when you add a key.");

  backendSimulator.ourKey.monthHasMade({});
  await page.clock.fastForward(3 * 60 * 60 * 1000);

  await expect.poll(() => overviewCount(backendSimulator)).toBe(1);
  expect(backendSimulator.ourKey.generations()).toHaveLength(1);
});

test("refused at the limit mid-run, the video stays waiting with the queue, not failed", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.refuses(429, "too_many_requests", { quota: "ours", resetsOn: "2026-11-01" });
  followingAt(backendSimulator, "asTheyCome", [queued(0), queued(1)]);
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);

  const strip = launcher.appShell.queueStrip;
  await strip.verifyReads("Queue waiting · 2 videos", "This month's overviews are made. Resumes 1 November.");
  await strip.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();
  await queuePage.verifyWaitingStatuses(["Waiting for 1 November", "Waiting for 1 November"]);
  await queuePage.verifyTryAgainIsOffered(false);
  expect(backendSimulator.getCallCount(EndpointKey.OUR_KEY_GENERATE)).toBe(1);
});

test("the month's limit wins over a playlist's pace: Choose is not offered while the queue waits for it", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.isAvailable();
  backendSimulator.ourKey.monthHasMade({ ours: 5 });
  followingAt(backendSimulator, "whenChosen", [queued(0), queued(1)]);
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);

  await launcher.appShell.queueStrip.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();
  await queuePage.verifyChooseIsOffered(false);
});

test("choosing more than the month has left makes what it can now and says when the rest go", async ({ launcher, backendSimulator }) => {
  backendSimulator.ourKey.monthHasMade({ own: 8 });
  followingAt(backendSimulator, "whenChosen", [queued(0), queued(1), queued(2)]);
  await launcher.launch(SIGNED_IN);

  await launcher.appShell.queueStrip.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();
  await queuePage.startChoosing();
  for (const video of VIDEOS) await queuePage.choose(video.title);
  await queuePage.verifyChosen(
    "3 chosen",
    "You have 2 left this month, so 2 are made now and the other 1 waits for 1 November. The rest of Psychology keep waiting for you.",
  );
  await queuePage.makeChosenNow("Make 2 now");

  await expect.poll(() => overviewCount(backendSimulator)).toBe(2);
  await queuePage.verifyWaitingForYou("Waiting for you · 1", [VIDEOS[2].title]);
});

test("the preview says what the allowance left means for a backfill it can't cover, at the pace chosen", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.ourKey.monthHasMade({ own: 9 });
  backendSimulator.playlists.seed(
    psychologyPlaylist(VIDEOS.map((video, index) => playlistEntry(video.id, video.title, `2026-09-0${index + 1}T09:00:00.000Z`))),
  );
  const form = await launcher.launchExpectingFirstRun(SIGNED_IN);
  await form.pasteUrl(PSYCHOLOGY_URL);
  const flow = launcher.appShell.playlistFlow;

  await flow.verifyAllowance(
    "Your allowance covers 1 more this month. At 5 a day that’s today; the other 2 wait for 1 November, then carry on at 5 a day.",
  );
  await flow.changePace("As they come", "All 3 are made one after another, until this month’s allowance runs out.");
  await flow.verifyAllowance(
    "1 of these 3 can be made now: you have 1 left this month. The other 2 wait in the queue and carry on by themselves on 1 November.",
  );
});
