import { z } from "zod";
import {
  apiLogLines,
  PlaylistId,
  VideoId,
  type PlaylistEntry,
  type PlaylistEntryAvailability,
  type PlaylistLookup,
} from "@overview/domain";
import type { YouTubeFetch } from "@overview/transcripts";
import { PlaylistUnavailableError, type PlaylistReader } from "./PlaylistReader.js";

const DATA_API = "https://www.googleapis.com/youtube/v3";
const PAGE_SIZE = 50;
// YouTube caps a playlist at 5,000 videos, so a hundred pages is every one of them.
const MAX_PAGES = 100;

const Thumbnail = z.object({ url: z.url() });

const PlaylistsResponse = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({ title: z.string(), channelTitle: z.string().optional() }),
      status: z.object({ privacyStatus: z.string() }),
    }),
  ),
});

const PlaylistItemsResponse = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(
    z.object({
      snippet: z.object({
        title: z.string(),
        publishedAt: z.iso.datetime({ offset: true }).optional(),
        videoOwnerChannelTitle: z.string().optional(),
        thumbnails: z.record(z.string(), Thumbnail).optional(),
        resourceId: z.object({ videoId: z.string().min(1) }),
      }),
      status: z.object({ privacyStatus: z.string() }).optional(),
    }),
  ),
});

export class YouTubeDataApiError extends Error {}

const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

// YouTube keeps a private or deleted video in the playlist with its title replaced, and
// says which only through these two markers (docs/features/playlists.md).
function availabilityOf(title: string, privacyStatus: string | undefined): PlaylistEntryAvailability {
  if (privacyStatus === "private") return "private";
  if (title === "Deleted video" || privacyStatus === undefined || privacyStatus === "privacyStatusUnspecified") {
    return "deleted";
  }
  return "available";
}

// The Data API answers a private playlist and a missing one alike, as nothing. oEmbed does
// not: it refuses a private one as unauthorised (docs/features/playlists.md).
async function whyUnavailable(youTubeFetch: YouTubeFetch, playlistId: string): Promise<"private" | "gone"> {
  const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
  const response = await youTubeFetch({
    url: `https://www.youtube.com/oembed?${query({ format: "json", url: playlistUrl })}`,
    method: "GET",
    headers: {},
  });
  return response.status === 401 || response.status === 403 ? "private" : "gone";
}

export function youTubeDataApiPlaylistReader({
  apiKey,
  youTubeFetch,
}: {
  apiKey: string;
  youTubeFetch: YouTubeFetch;
}): PlaylistReader {
  const get = async <T>(path: string, params: Record<string, string>, schema: z.ZodType<T>) => {
    // In a header rather than the query, so the key is never part of a URL that a log, a
    // proxy or an error message could carry (Google's API key best practices).
    const response = await youTubeFetch({
      url: `${DATA_API}/${path}?${query(params)}`,
      method: "GET",
      headers: { accept: "application/json", "x-goog-api-key": apiKey },
    });
    if (response.status === 404) return null;
    if (response.status !== 200) {
      throw new YouTubeDataApiError(`The YouTube Data API answered ${response.status} to ${path}`);
    }
    return schema.parse(JSON.parse(response.body));
  };

  return {
    async read(playlistId, log) {
      let units = 1;
      const playlists = await get("playlists", { part: "snippet,status", id: playlistId }, PlaylistsResponse);
      const playlist = playlists?.items[0];
      if (playlist === undefined) {
        log.info(apiLogLines.playlists.read({ units }));
        throw new PlaylistUnavailableError(await whyUnavailable(youTubeFetch, playlistId));
      }

      const entries: PlaylistEntry[] = [];
      let pageToken: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        units += 1;
        const items = await get(
          "playlistItems",
          {
            part: "snippet,status",
            playlistId,
            maxResults: String(PAGE_SIZE),
            ...(pageToken === undefined ? {} : { pageToken }),
          },
          PlaylistItemsResponse,
        );
        if (items === null) break;
        for (const { snippet, status } of items.items) {
          const thumbnails = snippet.thumbnails ?? {};
          entries.push({
            videoId: VideoId.parse(snippet.resourceId.videoId),
            title: snippet.title,
            channel: snippet.videoOwnerChannelTitle ?? null,
            thumbnailUrl: (thumbnails.medium ?? thumbnails.default)?.url ?? null,
            addedAt: snippet.publishedAt === undefined ? null : new Date(snippet.publishedAt).toISOString(),
            availability: availabilityOf(snippet.title, status?.privacyStatus),
          });
        }
        pageToken = items.nextPageToken;
        if (pageToken === undefined) break;
      }

      log.info(apiLogLines.playlists.read({ units, entries: entries.length }));
      const lookup: PlaylistLookup = {
        id: PlaylistId.parse(playlist.id),
        title: playlist.snippet.title,
        owner: playlist.snippet.channelTitle ?? null,
        privacy: playlist.status.privacyStatus === "unlisted" ? "unlisted" : "public",
        entries,
      };
      return lookup;
    },
  };
}
