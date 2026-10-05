import { PlaylistId, VideoId } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { EndpointKey } from "../../network/EndpointKey.testHelper.js";
import { IWFT_VIDEO_ID, makeServiceTranscriptFixture } from "../../network/fixtures/innerTubeFixtures.js";
import { PSYCHOLOGY_ID, PSYCHOLOGY_URL, playlistEntry, psychologyPlaylist } from "../../network/fixtures/playlistFixtures.js";

const API_KEYS = { anthropicApiKey: "sk-ant-test" };
const SIGNED_IN = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
  apiKeys: API_KEYS,
};

test("a pasted playlist is looked up and previewed with its counts and the estimate, all worked out from the playlist", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.playlists.seed(psychologyPlaylist());
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.pasteUrl(PSYCHOLOGY_URL);

  const flow = launcher.appShell.playlistFlow;
  await flow.verifyPreview({
    title: "Psychology",
    owner: "Veritasium · Public",
    facts: ["2 videos in the playlist", "2 to make, oldest first"],
    estimate: "About 60,000 tokens on your own API key",
    basis: "Estimate: 30,000 tokens per overview × 2",
  });
  await flow.verifyBackfillReads("Make overviews for all 2");
  await flow.verifyFirstActionIsFocused();
});

test("following with the backfill makes every video oldest first, and each overview says which playlist it came from", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.playlists.seed(psychologyPlaylist());
  backendSimulator.transcripts.seedService(makeServiceTranscriptFixture("secondVideo1", "How Your Brain Fills In the Gaps"));
  const form = await launcher.launchExpectingFirstRun(SIGNED_IN);

  await form.pasteUrl(PSYCHOLOGY_URL);
  await launcher.appShell.playlistFlow.followWithBackfill();

  await expect.poll(async () => (await backendSimulator.overviewStore.listOverviews()).length).toBe(2);
  const overviews = await backendSimulator.overviewStore.listOverviews();
  expect(overviews.map((overview) => overview.fromPlaylist)).toEqual([
    { id: PSYCHOLOGY_ID, title: "Psychology" },
    { id: PSYCHOLOGY_ID, title: "Psychology" },
  ]);
  expect(overviews.map((overview) => overview.video.id).sort()).toEqual([IWFT_VIDEO_ID, "secondVideo1"].sort());
  expect(await backendSimulator.playlists.listFollowed()).toMatchObject([{ id: PSYCHOLOGY_ID, title: "Psychology", unavailable: null }]);
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name.startsWith("playlists.")))
    .toEqual([{ name: "playlists.preview.followed", props: { from: "dialog", backfill: true, videos: 2, queued: 2 } }]);
});

test("following only new ones queues nothing, and a video already in the library is counted as skipped", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.playlists.seed(psychologyPlaylist());
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });
  await form.submitUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  await launcher.appShell.newOverviewDialog.clickReadOverview();

  const dialog = await launcher.appShell.openNewOverview();
  await dialog.form.pasteUrl(PSYCHOLOGY_URL);
  const flow = launcher.appShell.playlistFlow;
  await flow.verifyPreview({
    title: "Psychology",
    owner: "Veritasium · Public",
    facts: ["2 videos in the playlist", "1 already in your library, so it’s skipped", "1 to make, oldest first"],
    estimate: "About 30,000 tokens on your own API key",
    basis: "Estimate: 30,000 tokens per overview × 1",
  });
  await flow.verifyBackfillReads("Make its overview");
  await flow.followNewOnly();

  expect(await backendSimulator.playlists.listQueue()).toEqual([]);
  expect(await backendSimulator.playlists.listFollowed()).toHaveLength(1);
});

test("a video link inside a playlist asks which was meant, and Just this video carries on as before", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.playlists.seed(psychologyPlaylist());
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.fillUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}&list=${PSYCHOLOGY_ID}&index=1`);
  await form.verifyOffersVideoOrPlaylist("Psychology · 2 videos");
  await form.chooseJustThisVideo();

  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");
  const [overview] = await backendSimulator.overviewStore.listOverviews();
  expect(overview?.video.url).toBe(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`);
  expect(overview?.fromPlaylist).toBeNull();
});

test("a private playlist says why it can't be followed and what to do", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seedPrivate("PLmine");
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.pasteUrl("https://www.youtube.com/playlist?list=PLmine");

  const flow = launcher.appShell.playlistFlow;
  await flow.verifyRefusal("This playlist is private");
  await flow.verifyRefusalAction(null);
  await flow.pasteAnother();
  await form.verifyUrlInputHolds("");
});

test("Watch Later is refused without asking the server, since YouTube never shares it", async ({ launcher, backendSimulator }) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.pasteUrl("https://www.youtube.com/playlist?list=WL");

  await launcher.appShell.playlistFlow.verifyRefusal("YouTube keeps Watch Later to itself");
  expect(backendSimulator.getCallCount(EndpointKey.PLAYLIST_LOOKUP)).toBe(0);
});

test("a Mix can't be followed, but still offers the video it opens", async ({ launcher, backendSimulator }) => {
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.submitUrl(`https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}&list=RD${IWFT_VIDEO_ID}`);

  const flow = launcher.appShell.playlistFlow;
  await flow.verifyRefusal("Mixes can’t be followed");
  await flow.takeRefusalAction();
  await launcher.appShell.newOverviewDialog.verifyStepState("02", "done");
  expect(await backendSimulator.overviewStore.listOverviews()).toHaveLength(1);
});

test("an empty playlist can still be followed", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seed(psychologyPlaylist([]));
  const form = await launcher.launchExpectingFirstRun({ apiKeys: API_KEYS });

  await form.pasteUrl(PSYCHOLOGY_URL);
  const flow = launcher.appShell.playlistFlow;
  await flow.verifyRefusal("This playlist is empty");
  await flow.takeRefusalAction();

  await expect.poll(() => backendSimulator.playlists.listFollowed()).toHaveLength(1);
});

test("a playlist link on the home page opens the same preview", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seed(psychologyPlaylist());
  const home = await launcher.launch({ apiKeys: API_KEYS });

  await home.submitHeroUrl(PSYCHOLOGY_URL);

  await launcher.appShell.playlistFlow.verifyPreview({
    title: "Psychology",
    owner: "Veritasium · Public",
    facts: ["2 videos in the playlist", "2 to make, oldest first"],
    estimate: "About 60,000 tokens on your own API key",
    basis: "Estimate: 30,000 tokens per overview × 2",
  });
});

test("Settings lists followed playlists, and unfollowing takes their waiting videos out of the queue", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.playlists.seed(psychologyPlaylist());
  backendSimulator.playlists.seedFollowed({
    id: PlaylistId.parse(PSYCHOLOGY_ID),
    title: "Psychology",
    owner: "Veritasium",
    privacy: "public",
    followedAt: "2026-10-01T09:00:00.000Z",
    unavailable: null,
  });
  backendSimulator.playlists.seedCheck({
    playlistId: PlaylistId.parse(PSYCHOLOGY_ID),
    seenVideoIds: [VideoId.parse(IWFT_VIDEO_ID), VideoId.parse("secondVideo1")],
    checkedAt: "2026-10-05T09:00:00.000Z",
  });
  backendSimulator.playlists.seedQueued({
    videoId: VideoId.parse("secondVideo1"),
    url: "https://www.youtube.com/watch?v=secondVideo1",
    title: "How Your Brain Fills In the Gaps",
    thumbnailUrl: null,
    fromPlaylist: { id: PlaylistId.parse(PSYCHOLOGY_ID), title: "Psychology" },
    queuedAt: "2026-10-05T09:00:00.000Z",
    status: "waiting",
    problem: null,
  });
  await launcher.launch({});
  const settings = await launcher.appShell.openSettings();
  await settings.verifyRowReads("playlists", "Following 1");
  await settings.openSection("playlists");

  await settings.playlists.verifyFollowing(["Psychology"]);
  await settings.playlists.verifyMeta(0, "Veritasium · Public · 2 videos · 0 overviews");
  await settings.playlists.unfollow("Psychology", "1 video still queued from it is removed.");

  await settings.playlists.verifyEmpty();
  expect(await backendSimulator.playlists.listQueue()).toEqual([]);
  expect(await backendSimulator.playlists.listFollowed()).toEqual([]);
});

test("Settings looks a pasted playlist up and follows it", async ({ launcher, backendSimulator }) => {
  backendSimulator.playlists.seed(psychologyPlaylist());
  await launcher.launch({});
  const settings = await launcher.appShell.openSettings();
  await settings.openSection("playlists");
  await settings.playlists.verifyEmpty();

  await settings.playlists.lookUp("https://www.youtube.com/watch?v=x");
  await settings.playlists.verifyLinkError("That doesn’t look like a YouTube playlist link.");
  await settings.playlists.lookUp(PSYCHOLOGY_URL);
  await settings.playlists.flow.followNewOnly();

  await settings.playlists.verifyFollowing(["Psychology"]);
});
