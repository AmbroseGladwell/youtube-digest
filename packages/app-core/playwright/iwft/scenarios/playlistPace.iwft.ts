import { PlaylistId, VideoId, type FollowedPlaylist, type PlaylistPace, type QueuedCapture } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { makeServiceTranscriptFixture } from "../../network/fixtures/innerTubeFixtures.js";
import { PSYCHOLOGY_ID, PSYCHOLOGY_URL, psychologyPlaylist } from "../../network/fixtures/playlistFixtures.js";
import { makeOverview } from "../../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const API_KEYS = ANTHROPIC_KEY;
// Signed in, because events go over the reader's session (docs/architecture/analytics.md).
const SIGNED_IN_WITHOUT_A_KEY = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const SIGNED_IN = { ...SIGNED_IN_WITHOUT_A_KEY, apiKeys: API_KEYS };
const PSYCHOLOGY = { id: PlaylistId.parse(PSYCHOLOGY_ID), title: "Psychology" };
const LECTURES = { id: PlaylistId.parse("PLlectures01"), title: "Every Lecture" };
// The reader's own clock: a pace starts again at their midnight.
const LATE_EVENING = new Date(2026, 9, 26, 23, 0);
const AFTERNOON = new Date(2026, 9, 26, 15, 0);

const VIDEOS = [
  { id: "paceVideo01", title: "Why We Can't Remember Being Babies" },
  { id: "paceVideo02", title: "How Sleep Cleans the Brain" },
  { id: "paceVideo03", title: "The Placebo Paradox" },
] as const;

const queued = (index: number, overrides: Partial<QueuedCapture> = {}): QueuedCapture => ({
  videoId: VideoId.parse(VIDEOS[index]!.id),
  url: `https://www.youtube.com/watch?v=${VIDEOS[index]!.id}`,
  title: VIDEOS[index]!.title,
  thumbnailUrl: null,
  fromPlaylist: PSYCHOLOGY,
  queuedAt: `2026-10-05T09:00:00.00${index}Z`,
  status: "waiting",
  problem: null,
  chosenAt: null,
  ...overrides,
});

// Following Psychology at a pace, with this device having seen everything it holds, so opening
// queues nothing new and what is queued is only what the test seeds.
const followingAt = (backendSimulator: BackendSimulator, pace: PlaylistPace) => {
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
};

const seedQueuedWithTranscripts = (backendSimulator: BackendSimulator, captures: QueuedCapture[]) => {
  for (const capture of captures) {
    backendSimulator.transcripts.seedService(makeServiceTranscriptFixture(capture.videoId, capture.title));
    backendSimulator.playlists.seedQueued(capture);
  }
};

const overviewCount = async (backendSimulator: BackendSimulator) => (await backendSimulator.overviewStore.listOverviews()).length;

// The definition of done for OV-95: a paced playlist makes no more than its number a day, the
// rest of the queue isn't held up, and what waits says when it continues
// (docs/features/capture-queue.md, "Waiting on a pace").
test("a paced playlist makes its number for the day, the rest of the queue carries on, and its videos continue after midnight", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.clock.install({ time: LATE_EVENING });
  followingAt(backendSimulator, "oneADay");
  const lecture = { ...queued(0), videoId: VideoId.parse("otherVideo1"), url: "https://www.youtube.com/watch?v=otherVideo1", title: "A Short History of Maps", fromPlaylist: LECTURES, queuedAt: "2026-10-05T09:00:00.009Z" };
  seedQueuedWithTranscripts(backendSimulator, [queued(0), queued(1), queued(2), lecture]);

  await launcher.launch({ apiKeys: API_KEYS });

  await expect.poll(() => overviewCount(backendSimulator)).toBe(2);
  const made = (await backendSimulator.overviewStore.listOverviews()).map((overview) => overview.video.id).sort();
  expect(made).toEqual(["otherVideo1", "paceVideo01"]);
  const strip = launcher.appShell.queueStrip;
  await strip.verifyReads("Done for today", "2 waiting for tomorrow, at each playlist’s pace");
  await strip.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();
  await queuePage.verifyContinuesTomorrow("Continues tomorrow · 2", [VIDEOS[1].title, VIDEOS[2].title]);
  await queuePage.verifyPacedGroupMeta(["Up to 1 a day · 1 made today · 2 waiting"]);
  await queuePage.verifyTryAgainIsOffered(false);
  await expect
    .poll(() => backendSimulator.errors.batches().flatMap(({ warnings }) => warnings ?? []).filter(({ name }) => name === "captureQueuePaced"))
    .toEqual([expect.objectContaining({ name: "captureQueuePaced", pace: "oneADay", madeToday: 1, waiting: 2 })]);

  await page.clock.fastForward(61 * 60 * 1000);

  await expect.poll(() => overviewCount(backendSimulator)).toBe(3);
  await queuePage.verifyPacedGroupMeta(["Up to 1 a day · 1 made today · 1 waiting"]);
});

test("Make now makes a paced video next without counting toward its pace, which stays as it was", async ({ page, launcher, backendSimulator }) => {
  await page.clock.install({ time: AFTERNOON });
  followingAt(backendSimulator, "oneADay");
  backendSimulator.overviews.seed(
    makeOverview({
      savedAt: new Date(2026, 9, 26, 10, 0).toISOString(),
      fromPlaylist: PSYCHOLOGY,
      video: { ...makeOverview().video, id: VideoId.parse("madeToday01"), title: "Made This Morning" },
    }),
  );
  seedQueuedWithTranscripts(backendSimulator, [queued(0), queued(1)]);

  await launcher.launch(SIGNED_IN);

  await launcher.appShell.queueStrip.verifyReads("Done for today", "2 waiting for tomorrow, at each playlist’s pace");
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  await launcher.appShell.queueStrip.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();

  await queuePage.makeNow(VIDEOS[0].title);

  await queuePage.verifyMadeNowNotice(`Making “${VIDEOS[0].title}” next. Psychology stays at up to 1 a day.`);
  await expect.poll(() => overviewCount(backendSimulator)).toBe(2);
  await queuePage.verifyContinuesTomorrow("Continues tomorrow · 1", [VIDEOS[1].title]);
  await queuePage.verifyPacedGroupMeta(["Up to 1 a day · 1 made today · 1 waiting"]);
  expect((await backendSimulator.playlists.listFollowed())[0]?.pace).toBe("oneADay");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "queue.item.madeNow"))
    .toEqual([{ name: "queue.item.madeNow", props: { pace: "oneADay" } }]);
});

test("a playlist made only when chosen waits for the reader, who can choose several to make now or remove", async ({
  launcher,
  backendSimulator,
}) => {
  followingAt(backendSimulator, "whenChosen");
  seedQueuedWithTranscripts(backendSimulator, [queued(0), queued(1), queued(2)]);

  await launcher.launch(SIGNED_IN);

  const strip = launcher.appShell.queueStrip;
  await strip.verifyReads("Queue done · 3 waiting for you", "From Psychology, made when you choose them");
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  await strip.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();
  await queuePage.verifyWaitingForYou("Waiting for you · 3", VIDEOS.map((video) => video.title));

  await queuePage.startChoosing();
  await queuePage.choose(VIDEOS[0].title);
  await queuePage.choose(VIDEOS[2].title);
  await queuePage.verifyChosen("2 chosen", "Made next, oldest first. The rest of Psychology keep waiting for you.");
  await queuePage.makeChosenNow("Make 2 now");

  await expect.poll(() => overviewCount(backendSimulator)).toBe(2);
  await queuePage.verifyWaitingForYou("Waiting for you · 1", [VIDEOS[1].title]);

  await queuePage.startChoosing();
  await queuePage.choose(VIDEOS[1].title);
  await queuePage.removeChosen();

  await expect.poll(() => backendSimulator.playlists.listQueue()).toEqual([]);
  expect(await overviewCount(backendSimulator)).toBe(2);
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("queue.choose.")))
    .toEqual([
      { name: "queue.choose.started", props: {} },
      { name: "queue.choose.madeNow", props: { videos: 2 } },
      { name: "queue.choose.started", props: {} },
      { name: "queue.choose.removed", props: { videos: 1 } },
    ]);
});

test("Settings shows each playlist's pace and changes it, saying what the change did to what waits", async ({ launcher, backendSimulator }) => {
  followingAt(backendSimulator, "asTheyCome");
  seedQueuedWithTranscripts(backendSimulator, [queued(0), queued(1), queued(2)]);
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const settings = await launcher.appShell.openSettings();
  await settings.openSection("playlists");

  await settings.playlists.verifyPaceFacts(0, "As they come · 3 waiting");
  await settings.playlists.choosePace("Psychology", "Up to 1 a day", "3 waiting at 1 a day: about 3 days");

  await settings.playlists.verifyPaceSaid("Now up to 1 a day. 2 of the 3 wait for tomorrow.");
  await settings.playlists.verifyPaceFacts(0, "Up to 1 a day · 3 waiting");
  await expect.poll(async () => (await backendSimulator.playlists.listFollowed())[0]?.pace).toBe("oneADay");

  await settings.playlists.choosePace("new playlists", "Only when I choose");

  await expect.poll(async () => (await backendSimulator.settingsStore.get()).defaultPlaylistPace).toBe("whenChosen");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("playlists.settings.")))
    .toEqual([
      { name: "playlists.settings.paceChanged", props: { pace: "oneADay", waiting: 3 } },
      { name: "playlists.settings.defaultPaceChanged", props: { pace: "whenChosen" } },
    ]);
});

test("the preview follows at the reader's default pace unless they change it, and says what each pace would do", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.playlists.seed(psychologyPlaylist());
  const form = await launcher.launchExpectingFirstRun(SIGNED_IN);
  await form.pasteUrl(PSYCHOLOGY_URL);
  const flow = launcher.appShell.playlistFlow;

  await flow.verifyPace("Pace: Up to 5 a day · your default", "All 2 today, then up to 5 a day as new ones arrive.");
  await flow.changePace("Only when I choose", "All 2 wait in the queue until you choose them, and use none of your allowance until then.");
  await flow.followWithBackfill();

  await expect.poll(async () => (await backendSimulator.playlists.listFollowed())[0]?.pace).toBe("whenChosen");
  await expect.poll(async () => (await backendSimulator.playlists.listQueue()).length).toBe(2);
  expect(backendSimulator.getCallCount(EndpointKey.ANTHROPIC_MESSAGES)).toBe(0);
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "playlists.preview.followed"))
    .toEqual([
      {
        name: "playlists.preview.followed",
        props: { from: "dialog", backfill: true, videos: 2, queued: 2, pace: "whenChosen", paceIsDefault: false },
      },
    ]);
});
