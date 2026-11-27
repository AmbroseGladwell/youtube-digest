import { apiLogLines, type FeedEntry, type FeedFreshness, type FeedRead, type FeedReadFailure } from "@overview/domain";
import type { FastifyBaseLogger } from "fastify";
import { decodedChunks } from "../podcasts/fetchFeedEpisode.js";
import { readBodyText, type createPublicWebFetch, type PublicWebAnswer } from "../publicWeb/createPublicWebFetch.js";
import { feedKindOf, youTubeChannelIdOfFeed } from "./feedKindOf.js";
import { feedLinksInPage } from "./feedLinksInPage.js";
import type { FeedsRepository, StoredFeed } from "./FeedsRepository.js";
import { newestFirst, readFeedItems } from "./readFeedItems.js";

type FetchPublicWeb = ReturnType<typeof createPublicWebFetch>;
type FetchFailure = Extract<PublicWebAnswer, { status: "failed" }>;

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

// Why each number is what it is: docs/features/followed-feeds.md, "Load and spend".
export const FEED_LIMITS = {
  freshMs: 30 * MINUTE_MS,
  mostAtOnce: 16,
  mostPerHostAtOnce: 4,
  mostWaitMs: 10_000,
  mostPerHour: 3_000,
  mostEntries: 50,
  mostFeedBytes: 20 * 1024 * 1024,
  mostPageBytes: 2 * 1024 * 1024,
  firstBackoffMs: 30 * MINUTE_MS,
  mostBackoffMs: DAY_MS,
  goneAfterMs: 7 * DAY_MS,
  forgetUncheckedMs: 90 * DAY_MS,
  sweepEveryMs: HOUR_MS,
};
export type FeedLimits = typeof FEED_LIMITS;

const FEED_ACCEPT = "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.1";
const PAGE_ACCEPT = "text/html, application/xhtml+xml;q=0.9, */*;q=0.1";
const POLL_MS = 50;

type PageFeedLookup = { status: "found"; feedUrl: string } | { status: "none" } | { status: "busy" };

export interface FeedReaderOptions {
  feeds: FeedsRepository;
  fetchPublicWeb: FetchPublicWeb;
  clock: () => Date;
  limits?: FeedLimits;
  sleep?: (ms: number) => Promise<void>;
}

export interface FeedReader {
  read(feedUrl: string, log: FastifyBaseLogger): Promise<FeedRead>;
  lookUp(link: string, log: FastifyBaseLogger): Promise<FeedRead>;
}

type Outcome = "stored" | "fetched" | "notModified" | "failing" | "gone" | "busy" | "failed";

interface Read {
  read: FeedRead;
  outcome: Outcome;
  newEntries: number;
}

const failed = (reason: FeedReadFailure, outcome: Outcome = "failed"): Read => ({
  read: { status: "failed", reason },
  outcome,
  newEntries: 0,
});

const snapshotOf = (stored: StoredFeed, freshness: FeedFreshness): FeedRead => ({
  status: "read",
  feed: {
    feedUrl: stored.feedUrl,
    kind: stored.kind,
    title: stored.title,
    siteUrl: stored.siteUrl,
    imageUrl: stored.imageUrl,
    entries: stored.entries,
    fetchedAt: stored.fetchedAt.toISOString(),
    freshness,
  },
});

const failureReasonOf = (answer: FetchFailure): FeedReadFailure => {
  if (answer.reason === "closed") {
    return "closed";
  }
  return answer.reason === "missing" ? "missing" : "unreachable";
};

const newestDateOf = (entries: FeedEntry[]): string | null =>
  entries.reduce<string | null>(
    (newest, entry) => (entry.publishedAt !== null && (newest === null || entry.publishedAt > newest) ? entry.publishedAt : newest),
    null,
  );

const youTubeChannelFeedOf = (url: URL): string | null => {
  if (!/(^|\.)youtube\.com$/.test(url.hostname)) {
    return null;
  }
  const channelId = /^\/channel\/(UC[\w-]{22})\/?/.exec(url.pathname)?.[1];
  return channelId === undefined ? null : `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
};

export const canonicalFeedUrl = (link: string): string | null => {
  try {
    const url = new URL(link.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
};

// The stored copy, the limits and the back-off: docs/features/followed-feeds.md, "The stored copy".
export const createFeedReader = ({
  feeds,
  fetchPublicWeb,
  clock,
  limits = FEED_LIMITS,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: FeedReaderOptions): FeedReader => {
  const inFlight = new Map<string, Promise<Read>>();
  const fetchTimes: number[] = [];
  const perHost = new Map<string, number>();
  let running = 0;
  let lastSweepAt = Number.NEGATIVE_INFINITY;

  const withinHourlyBudget = (now: number): boolean => {
    while (fetchTimes.length > 0 && fetchTimes[0]! <= now - HOUR_MS) {
      fetchTimes.shift();
    }
    if (fetchTimes.length >= limits.mostPerHour) {
      return false;
    }
    fetchTimes.push(now);
    return true;
  };

  const withSlot = async <T>(host: string, run: () => Promise<T>): Promise<T | null> => {
    const deadline = clock().getTime() + limits.mostWaitMs;
    while (running >= limits.mostAtOnce || (perHost.get(host) ?? 0) >= limits.mostPerHostAtOnce) {
      if (clock().getTime() >= deadline) {
        return null;
      }
      await sleep(POLL_MS);
    }
    if (!withinHourlyBudget(clock().getTime())) {
      return null;
    }
    running += 1;
    perHost.set(host, (perHost.get(host) ?? 0) + 1);
    try {
      return await run();
    } finally {
      running -= 1;
      perHost.set(host, (perHost.get(host) ?? 1) - 1);
    }
  };

  const sweepIfDue = async (log: FastifyBaseLogger): Promise<void> => {
    const now = clock();
    if (now.getTime() - lastSweepAt < limits.sweepEveryMs) {
      return;
    }
    lastSweepAt = now.getTime();
    const count = await feeds.deleteUncheckedSince(new Date(now.getTime() - limits.forgetUncheckedMs));
    if (count > 0) {
      log.info(apiLogLines.feeds.forgotten({ count }));
    }
  };

  const recordFailure = async (stored: StoredFeed, answer: FetchFailure | null): Promise<Read> => {
    const now = clock();
    const failures = stored.failures + 1;
    const failingSince = stored.failingSince ?? now;
    const backoffMs = Math.min(limits.firstBackoffMs * 2 ** (failures - 1), limits.mostBackoffMs);
    const toldMs = (answer?.retryAfterSeconds ?? 0) * 1000;
    const waitMs = Math.min(Math.max(backoffMs, toldMs), limits.mostBackoffMs);
    const gone = answer?.httpStatus === 410 || now.getTime() - failingSince.getTime() >= limits.goneAfterMs;
    const updated: StoredFeed = { ...stored, failures, failingSince, nextTryAt: new Date(now.getTime() + waitMs), gone };
    await feeds.save(updated);
    return { read: snapshotOf(updated, gone ? "gone" : "failing"), outcome: gone ? "gone" : "failing", newEntries: 0 };
  };

  const fetchAndStore = async (feedUrl: string, stored: StoredFeed | null): Promise<Read> => {
    const headers: Record<string, string> = {};
    if (stored?.etag) {
      headers["if-none-match"] = stored.etag;
    }
    if (stored?.lastModified) {
      headers["if-modified-since"] = stored.lastModified;
    }
    const answer = await fetchPublicWeb(feedUrl, { accept: FEED_ACCEPT, headers });
    if (answer.status === "failed") {
      return stored === null ? failed(failureReasonOf(answer)) : recordFailure(stored, answer);
    }
    const now = clock();
    const fine = { fetchedAt: now, checkedAt: now, failures: 0, failingSince: null, nextTryAt: null, gone: false };
    const { response } = answer;
    if (response.status === 304) {
      if (stored === null) {
        return failed("unreachable");
      }
      const updated: StoredFeed = { ...stored, ...fine };
      await feeds.save(updated);
      return { read: snapshotOf(updated, "read"), outcome: "notModified", newEntries: 0 };
    }
    if (response.body === null) {
      return stored === null ? failed("notAFeed") : recordFailure(stored, null);
    }
    const known = new Set((stored?.entries ?? []).map((entry) => entry.id));
    const result = await readFeedItems(decodedChunks(response.body as ReadableStream<Uint8Array>, limits.mostFeedBytes), {
      feedUrl: answer.url,
      mostEntries: limits.mostEntries,
      isKnown: (id) => known.has(id),
      newestKnownAt: newestDateOf(stored?.entries ?? []),
    }).catch(() => null);
    if (result === null) {
      return stored === null ? failed("unreachable") : recordFailure(stored, null);
    }
    if (result.status === "notAFeed") {
      return stored === null ? failed("notAFeed") : recordFailure(stored, null);
    }
    const { feed } = result;
    const entries = newestFirst([
      ...feed.entries,
      ...(stored?.entries ?? []).filter((entry) => !feed.entries.some(({ id }) => id === entry.id)),
    ]).slice(0, limits.mostEntries);
    const updated: StoredFeed = {
      feedUrl,
      kind: feedKindOf(feedUrl, entries),
      title: feed.title ?? stored?.title ?? null,
      siteUrl: feed.siteUrl ?? stored?.siteUrl ?? null,
      imageUrl: feed.imageUrl ?? stored?.imageUrl ?? null,
      entries,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      ...fine,
    };
    await feeds.save(updated);
    return { read: snapshotOf(updated, "read"), outcome: "fetched", newEntries: feed.entries.length };
  };

  const readOnce = async (feedUrl: string): Promise<Read> => {
    const stored = await feeds.get(feedUrl);
    const now = clock();
    if (stored !== null) {
      await feeds.markChecked(feedUrl, now);
      if (stored.gone) {
        return { read: snapshotOf(stored, "gone"), outcome: "gone", newEntries: 0 };
      }
      if (now.getTime() - stored.fetchedAt.getTime() < limits.freshMs) {
        return { read: snapshotOf(stored, "stored"), outcome: "stored", newEntries: 0 };
      }
      if (stored.nextTryAt !== null && stored.nextTryAt > now) {
        return { read: snapshotOf(stored, "failing"), outcome: "failing", newEntries: 0 };
      }
    }
    const fetched = await withSlot(new URL(feedUrl).hostname, () => fetchAndStore(feedUrl, stored));
    if (fetched !== null) {
      return fetched;
    }
    return stored === null ? failed("busy", "busy") : { read: snapshotOf(stored, "stored"), outcome: "busy", newEntries: 0 };
  };

  const readShared = (feedUrl: string): Promise<Read> => {
    const running = inFlight.get(feedUrl);
    if (running !== undefined) {
      return running;
    }
    const reading = readOnce(feedUrl).finally(() => inFlight.delete(feedUrl));
    inFlight.set(feedUrl, reading);
    return reading;
  };

  const read = async (link: string, log: FastifyBaseLogger): Promise<FeedRead> => {
    const feedUrl = canonicalFeedUrl(link);
    if (feedUrl === null) {
      return { status: "failed", reason: "notAFeed" };
    }
    const startedAt = clock().getTime();
    const result = await readShared(feedUrl);
    log.info(
      apiLogLines.feeds.read({
        outcome: result.outcome,
        reason: result.read.status === "failed" ? result.read.reason : null,
        kind: result.read.status === "read" ? result.read.feed.kind : null,
        newEntries: result.newEntries,
        ms: clock().getTime() - startedAt,
      }),
    );
    await sweepIfDue(log);
    return result.read;
  };

  const feedLinkOfPage = async (pageUrl: string): Promise<PageFeedLookup> => {
    const page = await withSlot(new URL(pageUrl).hostname, async () => {
      const answer = await fetchPublicWeb(pageUrl, { accept: PAGE_ACCEPT });
      if (answer.status === "failed") {
        return "unreadable";
      }
      const html = await readBodyText(answer.response, limits.mostPageBytes);
      return html === null ? "unreadable" : { html, url: answer.url };
    });
    if (page === null) {
      return { status: "busy" };
    }
    const feedUrl = page === "unreadable" ? undefined : feedLinksInPage(page.html, page.url)[0]?.url;
    return feedUrl === undefined ? { status: "none" } : { status: "found", feedUrl };
  };

  const lookUp = async (link: string, log: FastifyBaseLogger): Promise<FeedRead> => {
    const startedAt = clock().getTime();
    const logged = (via: "feed" | "page" | "channel", answer: FeedRead): FeedRead => {
      log.info(
        apiLogLines.feeds.lookedUp({
          via,
          outcome: answer.status === "read" ? "found" : answer.reason,
          ms: clock().getTime() - startedAt,
        }),
      );
      return answer;
    };
    const feedUrl = canonicalFeedUrl(link);
    if (feedUrl === null) {
      return logged("feed", { status: "failed", reason: "notAFeed" });
    }
    const channelFeed = youTubeChannelFeedOf(new URL(feedUrl));
    if (channelFeed !== null) {
      return logged("channel", await read(channelFeed, log));
    }
    const direct = await read(feedUrl, log);
    if (direct.status === "read" || direct.reason !== "notAFeed") {
      return logged(youTubeChannelIdOfFeed(feedUrl) === null ? "feed" : "channel", direct);
    }
    const found = await feedLinkOfPage(feedUrl);
    if (found.status === "busy") {
      return logged("page", { status: "failed", reason: "busy" });
    }
    if (found.status === "none") {
      return logged("page", { status: "failed", reason: "noFeedOnPage" });
    }
    return logged("page", await read(found.feedUrl, log));
  };

  return { read, lookUp };
};
