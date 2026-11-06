import { PlaylistId, VideoId, type FollowedPlaylist, type PlaylistOrder, type QueuedCapture } from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import { SIMULATED_EMAIL, type BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { PSYCHOLOGY_ID, PSYCHOLOGY_URL, playlistEntry, psychologyPlaylist } from "../../network/fixtures/playlistFixtures.js";

// Signed in without a key, because events go over the reader's session and nothing should be
// made while the order is being read (docs/architecture/analytics.md).
const SIGNED_IN_WITHOUT_A_KEY = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, email: SIMULATED_EMAIL, firstName: "Ada" },
};
const PSYCHOLOGY = { id: PlaylistId.parse(PSYCHOLOGY_ID), title: "Psychology" };
const LECTURES = { id: PlaylistId.parse("PLlectures01"), title: "Every Lecture" };

const VIDEOS = [
  { id: "orderVideo1", title: "Why We Can't Remember Being Babies", addedAt: "2026-09-01T09:00:00.000Z" },
  { id: "orderVideo2", title: "How Sleep Cleans the Brain", addedAt: "2026-09-02T09:00:00.000Z" },
  { id: "orderVideo3", title: "The Placebo Paradox", addedAt: "2026-09-03T09:00:00.000Z" },
] as const;

const TITLES = VIDEOS.map((video) => video.title);
const playlist = () => psychologyPlaylist(VIDEOS.map((video) => playlistEntry(video.id, video.title, video.addedAt)));

// Queued in the playlist's own order, which is what following does, with another playlist's
// video sitting between them to show that reordering one leaves the rest where they are.
const queued = (index: number, queuedAt: string): QueuedCapture => ({
  videoId: VideoId.parse(VIDEOS[index]!.id),
  url: `https://www.youtube.com/watch?v=${VIDEOS[index]!.id}`,
  title: VIDEOS[index]!.title,
  thumbnailUrl: null,
  fromPlaylist: PSYCHOLOGY,
  queuedAt,
  status: "waiting",
  problem: null,
  chosenAt: null,
  addedAt: VIDEOS[index]!.addedAt,
  playlistIndex: index,
});

const LECTURE: QueuedCapture = {
  videoId: VideoId.parse("otherVideo1"),
  url: "https://www.youtube.com/watch?v=otherVideo1",
  title: "A Short History of Maps",
  thumbnailUrl: null,
  fromPlaylist: LECTURES,
  queuedAt: "2026-10-05T09:00:00.001Z",
  status: "waiting",
  problem: null,
  chosenAt: null,
  addedAt: "2026-08-01T09:00:00.000Z",
  playlistIndex: 0,
};

const followingIn = (backendSimulator: BackendSimulator, order: PlaylistOrder) => {
  const followed: FollowedPlaylist = {
    ...PSYCHOLOGY,
    owner: "Veritasium",
    privacy: "public",
    followedAt: "2026-09-01T00:00:00.000Z",
    unavailable: null,
    pace: "asTheyCome",
    order,
  };
  backendSimulator.playlists.seed(playlist());
  backendSimulator.playlists.seedFollowed(followed);
  backendSimulator.playlists.seedCheck({
    playlistId: PSYCHOLOGY.id,
    seenVideoIds: playlist().entries.map((entry) => entry.videoId),
    checkedAt: "2026-10-04T09:00:00.000Z",
  });
};

// The definition of done for OV-206: the reader chooses the order when they follow, changes it
// afterwards, and what is already waiting follows the change (docs/features/playlists.md, "An
// order for each playlist").
test("the preview follows in the reader's default order unless they change it, and the queue waits in the order chosen", async ({
  launcher,
  backendSimulator,
}) => {
  backendSimulator.playlists.seed(playlist());
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const settings = await launcher.appShell.openSettings();
  await settings.openSection("playlists");
  await settings.playlists.lookUp(PSYCHOLOGY_URL);
  const flow = settings.playlists.flow;

  await flow.verifyOrder("Order: Oldest first · your default", "The one you added longest ago is made first.");
  await flow.changeOrder("Newest first", "The one you added most recently is made first.");
  await flow.followWithBackfill();

  await expect.poll(async () => (await backendSimulator.playlists.listFollowed())[0]?.order).toBe("newestFirst");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "playlists.preview.followed"))
    .toEqual([
      {
        name: "playlists.preview.followed",
        props: {
          from: "settings",
          backfill: true,
          videos: 3,
          queued: 3,
          pace: "fiveADay",
          paceIsDefault: true,
          order: "newestFirst",
          orderIsDefault: false,
        },
      },
    ]);

  await launcher.appShell.queueStrip.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();
  await queuePage.verifyWaiting([TITLES[2]!, TITLES[1]!, TITLES[0]!]);
});

test("changing a playlist's order in Settings turns round what is already waiting, and leaves other playlists where they are", async ({
  launcher,
  backendSimulator,
}) => {
  followingIn(backendSimulator, "oldestFirst");
  for (const capture of [queued(0, "2026-10-05T09:00:00.000Z"), LECTURE, queued(1, "2026-10-05T09:00:00.002Z"), queued(2, "2026-10-05T09:00:00.003Z")]) {
    backendSimulator.playlists.seedQueued(capture);
  }
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  await launcher.appShell.queueStrip.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();

  await queuePage.verifyWaiting([TITLES[0]!, LECTURE.title, TITLES[1]!, TITLES[2]!]);

  const settings = await launcher.appShell.openSettings();
  await settings.openSection("playlists");
  await settings.playlists.verifyFacts(0, "As they come · oldest first · 3 waiting");
  await settings.playlists.chooseOrder("Psychology", "Newest first", "The 3 waiting are made newest first");

  await settings.playlists.verifySaid("Now newest first. The 3 waiting are back in order.");
  await settings.playlists.verifyFacts(0, "As they come · newest first · 3 waiting");
  await expect.poll(async () => (await backendSimulator.playlists.listFollowed())[0]?.order).toBe("newestFirst");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "playlists.settings.orderChanged"))
    .toEqual([{ name: "playlists.settings.orderChanged", props: { order: "newestFirst", waiting: 3 } }]);

  await launcher.appShell.queueStrip.openQueue();
  await queuePage.verifyIsShown();
  await queuePage.verifyWaiting([TITLES[2]!, LECTURE.title, TITLES[1]!, TITLES[0]!]);
});

test("the reader's default order is set in Settings, and only reaches playlists followed afterwards", async ({
  launcher,
  backendSimulator,
}) => {
  followingIn(backendSimulator, "oldestFirst");
  await launcher.launch(SIGNED_IN_WITHOUT_A_KEY);
  const settings = await launcher.appShell.openSettings();
  await settings.openSection("playlists");

  await settings.playlists.chooseOrder("new playlists", "The playlist’s order");

  await expect.poll(async () => (await backendSimulator.settingsStore.get()).defaultPlaylistOrder).toBe("playlistOrder");
  await settings.playlists.verifyFacts(0, "As they come · oldest first · nothing waiting");
  await expect
    .poll(() => backendSimulator.analytics.events().filter(({ name }) => name === "playlists.settings.defaultOrderChanged"))
    .toEqual([{ name: "playlists.settings.defaultOrderChanged", props: { order: "playlistOrder" } }]);
});
