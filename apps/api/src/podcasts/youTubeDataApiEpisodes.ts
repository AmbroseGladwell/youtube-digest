import { z } from "zod";
import {
  descriptionShare,
  DESCRIPTION_LEAD,
  DESCRIPTION_WORDS_SHARED,
  FEWEST_KEYWORDS,
  MOST_DESCRIPTIONS_READ,
  namesTheShow,
  publishedNearItsDate,
  retitledLengthMatches,
  searchedVideoMatch,
  titleMatch,
  type EpisodeOnYouTube,
  type EpisodeToFind,
  type YouTubeFetch,
} from "@overview/transcripts";
import { youTubeDataApiGet } from "../youTubeDataApi/youTubeDataApiGet.js";

const SearchResponse = z.object({
  items: z.array(
    z.object({ id: z.object({ videoId: z.string().optional() }), snippet: z.object({ channelId: z.string(), channelTitle: z.string() }) }),
  ),
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

interface SearchedVideo extends Upload {
  channelId: string;
  channelTitle: string;
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
const VIDEOS_SEARCHED = 10;
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

// The same episode on YouTube, found through the YouTube Data API on our key with one search: a
// video search for its title, the episode among the results by its title, length and date on any
// channel, then the show's own channel among the results, its uploads, and the episode there by
// its title and length or, retitled, its description and date: the rules the extension's search
// uses. Only its captions are read any other way, as no API offers them
// (docs/features/podcast-on-youtube.md, "Our server's search"; OV-294, OV-304).
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
    publishedNearItsDate(episode, upload.publishedAt, today) && retitledLengthMatches(episode, upload.lengthSeconds);

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
      const found = (upload: Upload, channelTitle: string, via: EpisodeOnYouTube["via"]): YouTubeEpisodeSearch => ({
        found: { videoId: upload.videoId, channelTitle, via },
        units,
        searches: 1,
      });
      const none = (): YouTubeEpisodeSearch => ({ found: null, units, searches: 1 });
      const today = now();

      const searched = await get(
        "search",
        { part: "snippet", type: "video", q: `${episode.showName} ${episode.title}`, maxResults: String(VIDEOS_SEARCHED) },
        SearchResponse,
      );
      const results = (searched?.items ?? []).flatMap(({ id, snippet }) =>
        id.videoId === undefined ? [] : [{ videoId: id.videoId, ...snippet }],
      );
      if (results.length === 0) return none();
      units += 1;
      const channelOf = new Map(results.map((result) => [result.videoId, result]));
      const listed: SearchedVideo[] = (await videos(results.map((result) => result.videoId))).flatMap((upload) => {
        const result = channelOf.get(upload.videoId);
        return result === undefined ? [] : [{ ...upload, channelId: result.channelId, channelTitle: result.channelTitle }];
      });
      const byVideo = searchedVideoMatch(episode, listed, (video) => publishedNearItsDate(episode, video.publishedAt, today));
      if (byVideo !== null) return found(byVideo, byVideo.channelTitle, "title");

      const named = [
        ...new Map(
          results
            .filter((result) => namesTheShow(result.channelTitle, episode.showName))
            .map((result) => [result.channelId, { id: result.channelId, title: result.channelTitle }]),
        ).values(),
      ].slice(0, CHANNELS_TRIED);
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
        if (byTitle !== null) return found(byTitle, channel.title, "title");
        firstPages.push({ channel, ...first });
      }

      const [showChannel] = firstPages;
      if (showChannel === undefined) return none();
      const uploads = [...showChannel.uploads];
      let next = showChannel.next;
      for (let more = 0; more < MORE_PAGES && next !== null; more += 1) {
        const following = await page(showChannel.channel, next);
        const byTitle = titleMatch(episode, following.uploads);
        if (byTitle !== null) return found(byTitle, showChannel.channel.title, "title");
        uploads.push(...following.uploads);
        next = following.next;
      }

      if (episode.keywords.length < FEWEST_KEYWORDS || episode.publishedAt === null) return none();
      const scored = uploads
        .filter((upload) => sameByDescription(episode, upload, today))
        .slice(0, MOST_DESCRIPTIONS_READ)
        .map((upload) => ({ upload, share: descriptionShare(episode.keywords, upload.description) }))
        .sort((a, b) => b.share - a.share);
      const [best, runnerUp] = scored;
      if (best === undefined || best.share < DESCRIPTION_WORDS_SHARED) return none();
      if (runnerUp !== undefined && runnerUp.share > best.share - DESCRIPTION_LEAD) return none();
      return found(best.upload, showChannel.channel.title, "description");
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
