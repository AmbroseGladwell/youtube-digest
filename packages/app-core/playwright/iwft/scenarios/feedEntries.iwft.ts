import {
  OverviewId,
  podcastSourceId,
  sourceKey,
  VideoId,
  type ExtractedArticle,
  type FeedEntry,
  type FollowedFeed,
  type PodcastEpisode,
  type QueuedCapture,
  type SourceKey,
} from "@overview/domain";
import { test, expect } from "../../support/fixtures.testHelper.js";
import type { BackendSimulator } from "../../network/BackendSimulator.testHelper.js";
import { SIMULATED_ACCOUNT_ID, SIMULATED_EMAIL } from "../../network/BackendSimulator.testHelper.js";
import { makeServiceTranscriptFixture } from "../../network/fixtures/innerTubeFixtures.js";
import { FEED_URL, makeFeedEntry, makeFollowedFeed } from "../../../src/features/feeds/types/FeedFactory.testHelper.js";
import { feedEntryCapture } from "../../../src/features/feeds/util/feedEntryCapture.js";
import { ANTHROPIC_KEY } from "../../support/apiKeysSeed.testHelper.js";

const SIGNED_IN_ON_US = {
  sync: true,
  syncConnection: { apiUrl: "https://sync.test", token: null, accountId: SIMULATED_ACCOUNT_ID, email: SIMULATED_EMAIL, firstName: "Ada" },
} as const;
const SIGNED_IN = { ...SIGNED_IN_ON_US, apiKeys: ANTHROPIC_KEY } as const;
const AFTERNOON = new Date(2026, 10, 28, 15, 0);

const EPISODE_ENTRY = makeFeedEntry("ep-1", "2026-11-27T09:00:00.000Z", { title: "The Fall of the Bridge" });
const VIDEO_ENTRY = makeFeedEntry("yt:video:VIDEO000001", "2026-11-26T09:00:00.000Z", {
  kind: "video",
  title: "A Video From The Channel",
  youTubeVideoId: "VIDEO000001",
  audioUrl: null,
});
const POST_ENTRY = makeFeedEntry("post-1", "2026-11-25T09:00:00.000Z", {
  kind: "article",
  title: "The town that pays its bridge bill twice",
  pageUrl: "https://theharbourpost.example/2026/11/bridge-bill-twice",
  audioUrl: null,
});

const EPISODE: PodcastEpisode = {
  feedUrl: FEED_URL,
  guid: "ep-1",
  title: "The Fall of the Bridge",
  showName: "The History Show",
  publishedAt: "2026-11-27T09:00:00.000Z",
  durationSeconds: 3600,
  audioUrl: "https://cdn.show.example/ep-1.mp3",
  pageUrl: "https://show.example/ep-1",
  imageUrl: null,
  notes: "This week, a bridge.",
  notesKeywords: [],
  transcripts: [],
  chaptersUrl: null,
  linkFrom: "feed",
};
const WORDS = {
  videoId: "podcast:episode" as never,
  segments: Array.from({ length: 12 }, (_, index) => ({
    startMs: index * 4_000,
    endMs: (index + 1) * 4_000,
    text: "The bridge over the firth fell in the winter of 1879, and the inquiry blamed the wind.",
  })),
  generated: true,
  fetchedAt: "2026-11-28T09:00:00.000Z",
};
const ARTICLE: ExtractedArticle = {
  url: POST_ENTRY.pageUrl!,
  title: POST_ENTRY.title!,
  siteName: "The Harbour Post",
  author: null,
  publishedAt: null,
  language: "en",
  imageUrl: null,
  sections: [{ heading: null, anchor: null, text: "The county reused a survey from 2011.", links: [] }],
  wordCount: 3220,
  recipe: null,
};

let ids = 0;
// The harness's queue is its own store, where the app's is a view over captures (IndexedDbCaptureQueueStore).
const keptFrom = async (feed: FollowedFeed, entry: FeedEntry, key: SourceKey, url: string): Promise<QueuedCapture> => {
  const kept = feedEntryCapture(
    { entry, sourceKey: key, url },
    feed,
    OverviewId.parse(`00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`),
    new Date(2026, 10, 28, 9, 0, 0, ids),
  );
  return {
    videoId: kept.sourceKey,
    url: kept.url,
    title: kept.title ?? "",
    thumbnailUrl: kept.thumbnailUrl,
    fromPlaylist: null,
    fromFeed: kept.fromFeed,
    source: kept.source,
    queuedAt: kept.keptAt,
    status: "waiting",
    problem: null,
    chosenAt: null,
    addedAt: kept.addedAt,
    playlistIndex: null,
  };
};

const episodeKey = async () => sourceKey({ kind: "podcast", id: await podcastSourceId({ feedUrl: FEED_URL, guid: "ep-1" }) })!;
const videoKey = VideoId.parse("VIDEO000001");
const videoUrl = "https://www.youtube.com/watch?v=VIDEO000001";

const overviews = (backendSimulator: BackendSimulator) => backendSimulator.overviewStore.listOverviews();

test("a chosen episode, video and post from a feed are each made their own way, and each overview names the feed", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.clock.install({ time: AFTERNOON });
  const feed = makeFollowedFeed({ pace: "whenChosen" });
  backendSimulator.feeds.seedFollowed(feed);
  backendSimulator.playlists.seedQueued(await keptFrom(feed, EPISODE_ENTRY, await episodeKey(), EPISODE.pageUrl!));
  backendSimulator.playlists.seedQueued(await keptFrom(feed, VIDEO_ENTRY, videoKey, videoUrl));
  backendSimulator.playlists.seedQueued(await keptFrom(feed, POST_ENTRY, `web:post` as SourceKey, ARTICLE.url));
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  backendSimulator.podcasts.wordsAre(WORDS);
  backendSimulator.articles.answerWith({ status: "read", article: ARTICLE });
  backendSimulator.transcripts.seedService(makeServiceTranscriptFixture("VIDEO000001", VIDEO_ENTRY.title!));
  backendSimulator.ourKey.isAvailable();

  await launcher.launch(SIGNED_IN_ON_US);
  await launcher.appShell.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();
  expect(await overviews(backendSimulator)).toEqual([]);

  for (const [index, entry] of [EPISODE_ENTRY, VIDEO_ENTRY, POST_ENTRY].entries()) {
    await queuePage.makeNow(entry.title!);
    await expect.poll(async () => (await overviews(backendSimulator)).length).toBe(index + 1);
  }

  const made = await overviews(backendSimulator);
  expect(made.map(({ source, fromFeed }) => [source.kind, fromFeed?.id])).toEqual(
    expect.arrayContaining([
      ["podcast", feed.id],
      ["youtube", feed.id],
      ["web", feed.id],
    ]),
  );
  expect(backendSimulator.podcasts.feedReads()).toEqual([{ feedUrl: FEED_URL, guid: "ep-1" }]);
  expect(backendSimulator.podcasts.transcriptionAsks()).toEqual([]);
  expect(backendSimulator.articles.reads()).toEqual([ARTICLE.url]);
  await expect.poll(async () => (await backendSimulator.playlists.listQueue()).length).toBe(0);
});

test("a feed at up to 1 a day makes one entry by itself, and the next waits for tomorrow", async ({ page, launcher, backendSimulator }) => {
  await page.clock.install({ time: AFTERNOON });
  const feed = makeFollowedFeed({ kind: "youTubeChannel", pace: "oneADay" });
  const second = makeFeedEntry("yt:video:VIDEO000002", "2026-11-27T09:00:00.000Z", {
    kind: "video",
    title: "The Second Video",
    youTubeVideoId: "VIDEO000002",
    audioUrl: null,
  });
  backendSimulator.feeds.seedFollowed(feed);
  backendSimulator.playlists.seedQueued(await keptFrom(feed, VIDEO_ENTRY, videoKey, videoUrl));
  backendSimulator.playlists.seedQueued(
    await keptFrom(feed, second, VideoId.parse("VIDEO000002"), "https://www.youtube.com/watch?v=VIDEO000002"),
  );
  for (const [id, title] of [
    ["VIDEO000001", VIDEO_ENTRY.title!],
    ["VIDEO000002", second.title!],
  ] as const) {
    backendSimulator.transcripts.seedService(makeServiceTranscriptFixture(id, title));
  }

  await launcher.launch(SIGNED_IN);

  await expect.poll(async () => (await overviews(backendSimulator)).length).toBe(1);
  await launcher.appShell.openQueue();
  const queuePage = await launcher.appShell.queuePage.verifyIsShown();
  await queuePage.verifyContinuesTomorrow("Continues tomorrow · 1", [VIDEO_ENTRY.title!]);
  expect((await overviews(backendSimulator))[0]?.fromFeed?.id).toBe(feed.id);
});

test("an episode with no transcript of its own is never transcribed by itself: it waits until the reader chooses it", async ({
  page,
  launcher,
  backendSimulator,
}) => {
  await page.clock.install({ time: AFTERNOON });
  const feed = makeFollowedFeed({ pace: "asTheyCome" });
  backendSimulator.feeds.seedFollowed(feed);
  backendSimulator.playlists.seedQueued(await keptFrom(feed, EPISODE_ENTRY, await episodeKey(), EPISODE.pageUrl!));
  backendSimulator.podcasts.answerWith({ status: "read", episode: EPISODE });
  backendSimulator.podcasts.offersTranscribing();

  await launcher.launch(SIGNED_IN);

  await expect
    .poll(async () => (await backendSimulator.playlists.listQueue()).map(({ status, problem }) => [status, problem]))
    .toEqual([["failed", "needsTranscribing"]]);
  expect(backendSimulator.podcasts.transcriptionAsks()).toEqual([]);
  expect(await overviews(backendSimulator)).toEqual([]);
});
