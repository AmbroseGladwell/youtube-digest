import { createHash } from "node:crypto";
import { fetch } from "undici";
import { z } from "zod";
import type { PodcastIndexKey } from "../loadConfig.js";
import { PUBLIC_WEB_USER_AGENT, readBodyText } from "../publicWeb/createPublicWebFetch.js";
import type { DirectoryEpisode, DirectoryShow, ShowDirectory } from "./appleDirectory.js";

const Feed = z.looseObject({
  id: z.number(),
  title: z.string(),
  url: z.string().optional(),
});

const Item = z.looseObject({
  id: z.number(),
  title: z.string(),
  guid: z.string().nullish(),
  datePublished: z.number().nullish(),
  duration: z.number().nullish(),
});

const Feeds = z.object({ feeds: z.array(z.unknown()) });
const Items = z.object({ items: z.array(z.unknown()) });
const OneFeed = z.object({ feed: z.unknown() });

export type FetchSignedJson = (url: string, headers: Record<string, string>) => Promise<unknown>;

const API = "https://api.podcastindex.org/api/1.0";
const MOST_JSON_BYTES = 5 * 1024 * 1024;
const ANSWER_WITHIN_MS = 10_000;
const MOST_EPISODES = 200;
const MOST_SHOWS = 10;

const parsed = <T>(schema: z.ZodType<T>, rows: readonly unknown[]): T[] =>
  rows.flatMap((row) => {
    const result = schema.safeParse(row);
    return result.success ? [result.data] : [];
  });

const toShow = (feed: z.infer<typeof Feed>): DirectoryShow => ({
  showId: String(feed.id),
  showName: feed.title,
  feedUrl: feed.url === undefined || feed.url === "" ? null : feed.url,
});

const toEpisode = (item: z.infer<typeof Item>): DirectoryEpisode => ({
  episodeId: String(item.id),
  guid: item.guid ?? null,
  title: item.title,
  publishedAt: item.datePublished == null || item.datePublished <= 0 ? null : new Date(item.datePublished * 1000).toISOString(),
  durationSeconds: item.duration == null || item.duration <= 0 ? null : Math.round(item.duration),
});

// Every request is signed: the key, its secret and the time, hashed together, with the time sent
// beside it and accepted within three minutes of theirs (Podcast Index's API docs).
export const podcastIndexHeaders = ({ apiKey, apiSecret }: PodcastIndexKey, now: Date): Record<string, string> => {
  const date = String(Math.floor(now.getTime() / 1000));
  return {
    "X-Auth-Key": apiKey,
    "X-Auth-Date": date,
    Authorization: createHash("sha1").update(`${apiKey}${apiSecret}${date}`).digest("hex"),
  };
};

// The open podcast directory, asked before Apple's on a Spotify link: a show by its name, and its
// newest episodes' guids (docs/features/podcast-links.md, "The directories"; OV-294).
export function podcastIndexDirectory(
  key: PodcastIndexKey,
  fetchSignedJson: FetchSignedJson,
  now: () => Date = () => new Date(),
): ShowDirectory {
  const ask = (path: string, params: Record<string, string>) =>
    fetchSignedJson(`${API}/${path}?${new URLSearchParams(params).toString()}`, podcastIndexHeaders(key, now()));

  return {
    async searchShows(name) {
      const { feeds } = Feeds.parse(await ask("search/byterm", { q: name, max: String(MOST_SHOWS) }));
      return parsed(Feed, feeds).map(toShow);
    },
    async showWithEpisodes(showId) {
      const [podcast, episodes] = await Promise.all([
        ask("podcasts/byfeedid", { id: showId }),
        ask("episodes/byfeedid", { id: showId, max: String(MOST_EPISODES) }),
      ]);
      const [show] = parsed(Feed, [OneFeed.parse(podcast).feed]);
      return show === undefined ? null : { show: toShow(show), episodes: parsed(Item, Items.parse(episodes).items).map(toEpisode) };
    },
  };
}

export const fetchPodcastIndexJson: FetchSignedJson = async (url, headers) => {
  const response = await fetch(url, {
    headers: { ...headers, accept: "application/json", "user-agent": PUBLIC_WEB_USER_AGENT },
    signal: AbortSignal.timeout(ANSWER_WITHIN_MS),
  });
  if (response.status !== 200) throw new Error(`Podcast Index answered ${response.status}`);
  const text = await readBodyText(response, MOST_JSON_BYTES);
  if (text === null) throw new Error("Podcast Index answered with more than we read");
  return JSON.parse(text);
};
