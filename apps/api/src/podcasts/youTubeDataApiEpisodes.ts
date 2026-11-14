import { z } from "zod";
import {
  daysAgo,
  descriptionShare,
  DESCRIPTION_LEAD,
  DESCRIPTION_WORDS_SHARED,
  FEWEST_KEYWORDS,
  MOST_DAYS_APART,
  MOST_DESCRIPTIONS_READ,
  namesTheShow,
  retitledLengthMatches,
  titleMatch,
  type EpisodeOnYouTube,
  type EpisodeToFind,
  type YouTubeFetch,
} from "@overview/transcripts";
import { youTubeDataApiGet } from "../youTubeDataApi/youTubeDataApiGet.js";

const SearchResponse = z.object({
  items: z.array(z.object({ id: z.object({ channelId: z.string().optional() }), snippet: z.object({ title: z.string() }) })),
});

const ChannelsResponse = z.object({
  items: z
    .array(z.object({ id: z.string(), contentDetails: z.object({ relatedPlaylists: z.object({ uploads: z.string().optional() }) }) }))
    .default([]),
});

const PlaylistItemsResponse = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(z.object({ contentDetails: z.object({ videoId: z.string() }) })),
});

const VideosResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({ title: z.string(), description: z.string().default(""), publishedAt: z.string().optional() }),
        contentDetails: z.object({ duration: z.string().optional() }),
      }),
    )
    .default([]),
});

interface Upload {
  videoId: string;
  title: string;
  lengthSeconds: number | null;
  description: string;
  publishedAt: string | null;
  age: null;
}

interface Channel {
  title: string;
  uploadsId: string;
}

export interface YouTubeEpisodeSearch {
  found: EpisodeOnYouTube | null;
  // What the search cost in the Data API's daily quota, search.list counted apart since it has
  // its own, smaller allowance.
  units: number;
  searches: number;
}

export interface YouTubeEpisodes {
  find(episode: EpisodeToFind): Promise<YouTubeEpisodeSearch>;
  confirm(episode: EpisodeToFind, videoId: string): Promise<"title" | "description" | null>;
}

const CHANNELS_TRIED = 3;
const PAGE_SIZE = 50;
const MORE_PAGES = 5;
const ISO_DURATION = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

export function isoDurationSeconds(duration: string | undefined): number | null {
  const parts = ISO_DURATION.exec(duration ?? "");
  if (parts === null) return null;
  const [days, hours, minutes, seconds] = parts.slice(1).map((part) => Number(part ?? 0));
  const total = days! * 86_400 + hours! * 3_600 + minutes! * 60 + seconds!;
  return total > 0 ? total : null;
}

// The same episode on the show's own channel, found through the YouTube Data API on our key: the
// show's channels by name, each one's uploads with their lengths, and the episode among them by
// the rules the extension's search uses, its title and length or, retitled, its description and
// date. Only its captions are read any other way, as no API offers them
// (docs/features/podcast-on-youtube.md, "Our server's search"; OV-294).
export function youTubeDataApiEpisodes({
  apiKey,
  youTubeFetch,
  now = () => new Date(),
}: {
  apiKey: string;
  youTubeFetch: YouTubeFetch;
  now?: () => Date;
}): YouTubeEpisodes {
  const get = youTubeDataApiGet({ apiKey, youTubeFetch });

  const videos = async (ids: readonly string[]): Promise<Upload[]> => {
    if (ids.length === 0) return [];
    const answer = await get(
      "videos",
      { part: "snippet,contentDetails", id: ids.join(","), maxResults: String(PAGE_SIZE) },
      VideosResponse,
    );
    const byId = new Map((answer?.items ?? []).map((video) => [video.id, video]));
    return ids.flatMap((id) => {
      const video = byId.get(id);
      if (video === undefined) return [];
      return [
        {
          videoId: id,
          title: video.snippet.title,
          lengthSeconds: isoDurationSeconds(video.contentDetails.duration),
          description: video.snippet.description,
          publishedAt: video.snippet.publishedAt ?? null,
          age: null,
        },
      ];
    });
  };

  const sameByDescription = (episode: EpisodeToFind, upload: Upload, today: Date): boolean =>
    episode.publishedAt !== null &&
    upload.publishedAt !== null &&
    Math.abs(daysAgo(upload.publishedAt, today) - daysAgo(episode.publishedAt, today)) <= MOST_DAYS_APART &&
    retitledLengthMatches(episode, upload.lengthSeconds);

  return {
    async find(episode) {
      let units = 0;
      const page = async (channel: Channel, pageToken: string | null) => {
        units += 2;
        const listed = await get(
          "playlistItems",
          {
            part: "contentDetails",
            playlistId: channel.uploadsId,
            maxResults: String(PAGE_SIZE),
            ...(pageToken === null ? {} : { pageToken }),
          },
          PlaylistItemsResponse,
        );
        const uploads = await videos((listed?.items ?? []).map((item) => item.contentDetails.videoId));
        return { uploads, next: listed?.nextPageToken ?? null };
      };
      const found = (upload: Upload, channel: Channel, via: EpisodeOnYouTube["via"]): YouTubeEpisodeSearch => ({
        found: { videoId: upload.videoId, channelTitle: channel.title, via },
        units,
        searches: 1,
      });
      const none = (): YouTubeEpisodeSearch => ({ found: null, units, searches: 1 });

      const searched = await get(
        "search",
        { part: "snippet", type: "channel", q: episode.showName, maxResults: String(CHANNELS_TRIED) },
        SearchResponse,
      );
      const named = (searched?.items ?? []).flatMap(({ id, snippet }) =>
        id.channelId === undefined ? [] : [{ id: id.channelId, title: snippet.title }],
      );
      if (named.length === 0) return none();
      units += 1;
      const details = await get("channels", { part: "contentDetails", id: named.map((channel) => channel.id).join(",") }, ChannelsResponse);
      const uploadsOf = new Map((details?.items ?? []).map((channel) => [channel.id, channel.contentDetails.relatedPlaylists.uploads]));
      const channels: Channel[] = named.flatMap(({ id, title }) => {
        const uploadsId = uploadsOf.get(id);
        return uploadsId === undefined ? [] : [{ title, uploadsId }];
      });

      const firstPages: { channel: Channel; uploads: Upload[]; next: string | null }[] = [];
      for (const channel of channels) {
        const first = await page(channel, null);
        const byTitle = titleMatch(episode, first.uploads);
        if (byTitle !== null) return found(byTitle, channel, "title");
        firstPages.push({ channel, ...first });
      }

      const showChannel = firstPages.find(({ channel }) => namesTheShow(channel.title, episode.showName));
      if (showChannel === undefined) return none();
      const uploads = [...showChannel.uploads];
      let next = showChannel.next;
      for (let more = 0; more < MORE_PAGES && next !== null; more += 1) {
        const following = await page(showChannel.channel, next);
        const byTitle = titleMatch(episode, following.uploads);
        if (byTitle !== null) return found(byTitle, showChannel.channel, "title");
        uploads.push(...following.uploads);
        next = following.next;
      }

      if (episode.keywords.length < FEWEST_KEYWORDS || episode.publishedAt === null) return none();
      const today = now();
      const scored = uploads
        .filter((upload) => sameByDescription(episode, upload, today))
        .slice(0, MOST_DESCRIPTIONS_READ)
        .map((upload) => ({ upload, share: descriptionShare(episode.keywords, upload.description) }))
        .sort((a, b) => b.share - a.share);
      const [best, runnerUp] = scored;
      if (best === undefined || best.share < DESCRIPTION_WORDS_SHARED) return none();
      if (runnerUp !== undefined && runnerUp.share > best.share - DESCRIPTION_LEAD) return none();
      return found(best.upload, showChannel.channel, "description");
    },

    // Whether one video is the episode, by the same rules, from its own details: one unit.
    async confirm(episode, videoId) {
      const [upload] = await videos([videoId]);
      if (upload === undefined) return null;
      if (titleMatch(episode, [upload]) !== null) return "title";
      if (episode.keywords.length < FEWEST_KEYWORDS) return null;
      return sameByDescription(episode, upload, now()) && descriptionShare(episode.keywords, upload.description) >= DESCRIPTION_WORDS_SHARED
        ? "description"
        : null;
    },
  };
}
