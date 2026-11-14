import { parsePodcastLink, PodcastEpisode, type PodcastLinkFrom, type PodcastRead, type PodcastReadFailure } from "@overview/domain";
import { episodeKeywords } from "@overview/transcripts";
import type { createPublicWebFetch } from "../publicWeb/createPublicWebFetch.js";
import { readBodyText } from "../publicWeb/createPublicWebFetch.js";
import { appleDirectory, type DirectoryShow, type ShowDirectory } from "./appleDirectory.js";
import { callBudget, type CallBudgetOptions } from "./callBudget.js";
import { pageMeta, type PageMeta } from "./pageMeta.js";
import { feedItemGuid, fetchFeedEpisode, MOST_FEED_BYTES, type FeedRead } from "./fetchFeedEpisode.js";
import type { FeedItem } from "./readFeedEpisode.js";
import { episodeTitleKey, pickEpisode, sameEpisode, type EpisodeFacts } from "./sameEpisode.js";
import { spotifyEpisodeFacts } from "./spotifyEpisodeFacts.js";

type FetchPublicWeb = ReturnType<typeof createPublicWebFetch>;

export interface PodcastReaderOptions {
  fetchPublicWeb: FetchPublicWeb;
  mostFeedBytes?: number;
  // Every Apple call shares one budget and its answers are kept (callBudget.ts); without it,
  // as in tests, each call goes straight to Apple.
  appleBudget?: CallBudgetOptions;
  // The open directory asked before Apple's on a Spotify link, or null to ask only Apple's.
  podcastIndex?: ShowDirectory | null;
}

const HTML = "text/html,application/xhtml+xml";
const MOST_PAGE_BYTES = 3 * 1024 * 1024;
const MOST_JSON_BYTES = 5 * 1024 * 1024;
const MOST_SHOWS_TRIED = 3;
const XML_TYPE = /\b(application|text)\/(rss\+xml|atom\+xml|xml)\b/i;

const failed = (reason: PodcastReadFailure, showName?: string | null): PodcastRead => ({
  status: "failed",
  reason,
  showName: showName ?? null,
});

class NoAnswerError extends Error {}

const samePage = (a: string | null, b: string | null): boolean => {
  if (a === null || b === null) return false;
  const key = (link: string) => {
    const url = new URL(link);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  };
  return key(a) === key(b);
};

// docs/features/podcast-links.md
export function createPodcastReader({
  fetchPublicWeb,
  mostFeedBytes = MOST_FEED_BYTES,
  appleBudget,
  podcastIndex = null,
}: PodcastReaderOptions) {
  const fetchPage = async (link: string): Promise<{ url: string; html: string; isFeed: boolean } | { failure: PodcastReadFailure }> => {
    const answer = await fetchPublicWeb(link, { accept: HTML });
    if (answer.status === "failed") return { failure: answer.reason === "no-answer" ? "no-answer" : "not-found" };
    const isFeed = XML_TYPE.test(answer.response.headers.get("content-type") ?? "");
    try {
      const html = await readBodyText(answer.response, MOST_PAGE_BYTES);
      return html === null ? { failure: "not-an-episode" } : { url: answer.url, html, isFeed };
    } catch {
      return { failure: "no-answer" };
    }
  };

  const fetchJson = async (url: string): Promise<unknown> => {
    const answer = await fetchPublicWeb(url, { accept: "application/json" });
    if (answer.status === "failed") throw new NoAnswerError(answer.reason);
    const text = await readBodyText(answer.response, MOST_JSON_BYTES);
    if (text === null) throw new NoAnswerError("too long");
    return JSON.parse(text);
  };

  const directory = appleDirectory(appleBudget === undefined ? fetchJson : callBudget(fetchJson, appleBudget));

  const readFeed = (feedUrl: string, isWanted: (item: FeedItem) => boolean): Promise<FeedRead> =>
    fetchFeedEpisode(fetchPublicWeb, feedUrl, isWanted, mostFeedBytes);

  const episodeFrom = async (feedUrl: string, read: FeedRead, linkFrom: PodcastLinkFrom, showName: string | null): Promise<PodcastRead> => {
    if (read.status === "failed") return failed(read.reason, showName);
    const { show, item } = read.feed;
    const name = show.title ?? showName;
    if (item === null || item.audioUrl === null || item.title === null) return failed("not-found", name);
    const episode = PodcastEpisode.safeParse({
      feedUrl,
      guid: feedItemGuid(item),
      title: item.title,
      showName: name ?? new URL(feedUrl).hostname,
      publishedAt: item.publishedAt,
      durationSeconds: item.durationSeconds,
      audioUrl: item.audioUrl,
      pageUrl: item.pageUrl,
      imageUrl: item.imageUrl ?? show.imageUrl,
      notes: item.notes,
      notesKeywords: episodeKeywords(item.notes, read.feed.neighbourNotes),
      transcripts: item.transcripts,
      chaptersUrl: item.chaptersUrl,
      linkFrom,
    });
    return episode.success ? { status: "read", episode: episode.data } : failed("feed-unreadable", name);
  };

  const fromFeed = async (
    show: DirectoryShow,
    facts: EpisodeFacts,
    guid: string | null,
    linkFrom: PodcastLinkFrom,
  ): Promise<PodcastRead> => {
    if (show.feedUrl === null) return failed("no-public-feed", show.showName);
    const read = await readFeed(show.feedUrl, (item) => (guid !== null && item.guid === guid) || sameEpisode(facts, item));
    return episodeFrom(show.feedUrl, read, linkFrom, show.showName);
  };

  // Apple's link names its own episode id, which only its directory maps to the feed's episode,
  // and only for the show's newest 200. Apple's web pages aren't read, so an older episode from an
  // Apple link says so and points to another link (OV-297, the terms review).
  const fromApple = async (showId: string, episodeId: string): Promise<PodcastRead> => {
    const listing = await directory.showWithEpisodes(showId);
    if (listing === null) return failed("not-found");
    if (listing.show.feedUrl === null) return failed("no-public-feed", listing.show.showName);
    const listed = listing.episodes.find((episode) => episode.episodeId === episodeId);
    if (listed === undefined) return failed("not-listed", listing.show.showName);
    return fromFeed(listing.show, listed, listed.guid, "apple");
  };

  // The show by the name Spotify's page gives, in each directory in turn until one knows it: an
  // exact name only, and at most three of them, each read from its own feed. A directory that
  // fails or doesn't know the show hands on to the next (docs/features/podcast-links.md).
  const fromSpotify = async (episodeId: string): Promise<PodcastRead> => {
    const page = await fetchPage(`https://open.spotify.com/episode/${episodeId}`);
    if ("failure" in page) return failed(page.failure);
    const facts = spotifyEpisodeFacts(pageMeta(page.html, page.url));
    if (facts === null) return failed("not-found");
    if (facts.showName === null) return failed("no-public-feed");
    const showKey = episodeTitleKey(facts.showName);
    const showDirectories: ShowDirectory[] = podcastIndex === null ? [directory] : [podcastIndex, directory];
    for (const [index, showDirectory] of showDirectories.entries()) {
      const isLast = index === showDirectories.length - 1;
      let shows: DirectoryShow[];
      try {
        shows = (await showDirectory.searchShows(facts.showName))
          .filter((show) => episodeTitleKey(show.showName) === showKey)
          .slice(0, MOST_SHOWS_TRIED);
      } catch (error) {
        if (isLast) throw error;
        continue;
      }
      if (shows.length === 0) continue;
      for (const show of shows) {
        const listing = await showDirectory.showWithEpisodes(show.showId).catch((error: unknown) => {
          if (isLast) throw error;
          return null;
        });
        const listed = listing === null ? null : pickEpisode(facts, listing.episodes);
        const read = await fromFeed(listing?.show ?? show, facts, listed?.guid ?? null, "spotify");
        if (read.status === "read" || read.reason === "no-answer") return read;
      }
      return failed("not-found", facts.showName);
    }
    return failed("no-public-feed", facts.showName);
  };

  // A page that names no feed: its title, searched in Apple's directory, accepted only where an
  // episode has exactly that title and the page names the episode's show as well
  // (docs/features/podcast-links.md, "A show's own episode page").
  const fromDirectorySearch = async (pageTitles: readonly string[]): Promise<PodcastRead> => {
    const pageText = episodeTitleKey(pageTitles.join(" "));
    const episodeTitles = [...new Set(pageTitles.flatMap((title) => [title, title.split(/\s+[-|–—]\s+/)[0]!]))].filter(
      (title) => title.trim() !== "",
    );
    for (const title of episodeTitles.slice(0, MOST_SHOWS_TRIED)) {
      const found = (await directory.searchEpisodes(title)).find(
        ({ show, episode }) =>
          sameEpisode({ title, publishedAt: null, durationSeconds: null }, episode) && pageText.includes(episodeTitleKey(show.showName)),
      );
      if (found !== undefined) return fromFeed(found.show, found.episode, found.episode.guid, "page");
    }
    return failed("not-an-episode");
  };

  const fromPage = async (link: string): Promise<PodcastRead> => {
    const page = await fetchPage(link);
    if ("failure" in page) return failed(page.failure);
    if (page.isFeed) return failed("not-an-episode");
    const meta: PageMeta = pageMeta(page.html, page.url);
    const pageUrls = [page.url, meta.canonicalUrl, meta.meta.get("og:url") ?? null];
    const titles = [meta.meta.get("og:title") ?? null, meta.title].filter((title): title is string => title !== null);
    if (meta.feedUrl === null) return fromDirectorySearch(titles);
    const read = await readFeed(
      meta.feedUrl,
      (item) =>
        pageUrls.some((url) => samePage(url, item.pageUrl)) ||
        titles.some((title) => sameEpisode({ title, publishedAt: null, durationSeconds: null }, item)),
    );
    return episodeFrom(meta.feedUrl, read, "page", null);
  };

  return async function readPodcastEpisode(link: string): Promise<PodcastRead> {
    try {
      let parsed = parsePodcastLink(link);
      if (parsed?.platform === "spotify-short") {
        const page = await fetchPage(parsed.url);
        if ("failure" in page) return failed(page.failure);
        const followed = parsePodcastLink(page.url);
        parsed = followed?.platform === "spotify" ? followed : parsePodcastLink(pageMeta(page.html, page.url).meta.get("og:url") ?? "");
      }
      switch (parsed?.platform) {
        case "apple":
          return await fromApple(parsed.showId, parsed.episodeId);
        case "spotify":
          return await fromSpotify(parsed.episodeId);
        case "page":
          return await fromPage(parsed.url);
        default:
          return failed("not-an-episode");
      }
    } catch {
      return failed("no-answer");
    }
  };
}
