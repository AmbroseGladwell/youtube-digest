import type { YouTubeFetch, YouTubeFetchRequest } from "@overview/transcripts";

export const FAKE_API_KEY = "test-youtube-key";

export interface FakePlaylistItem {
  videoId: string;
  title: string;
  privacyStatus?: string;
  addedAt?: string;
  channel?: string;
}

export interface FakePlaylist {
  id: string;
  title: string;
  channelTitle: string;
  privacyStatus: "public" | "unlisted" | "private";
  items: FakePlaylistItem[];
}

export interface FakeYouTubeDataApi {
  youTubeFetch: YouTubeFetch;
  requests: YouTubeFetchRequest[];
}

const PAGE_SIZE = 50;

// The two Data API calls and the oEmbed check, answered in the shapes YouTube sends: a
// private playlist is invisible to an API key and refused by oEmbed as unauthorised; a
// missing one is invisible to both.
export function makeFakeYouTubeDataApi(playlists: FakePlaylist[]): FakeYouTubeDataApi {
  const requests: YouTubeFetchRequest[] = [];
  const json = (status: number, body: unknown) => ({ status, body: JSON.stringify(body) });

  const youTubeFetch: YouTubeFetch = async (request) => {
    requests.push(request);
    const url = new URL(request.url);
    if (url.hostname === "www.youtube.com" && url.pathname === "/oembed") {
      const listId = new URL(url.searchParams.get("url")!).searchParams.get("list");
      const playlist = playlists.find((candidate) => candidate.id === listId);
      if (playlist === undefined) return { status: 404, body: "Not Found" };
      return playlist.privacyStatus === "private" ? { status: 401, body: "Unauthorized" } : json(200, { title: playlist.title });
    }
    if (url.searchParams.get("key") !== FAKE_API_KEY) {
      return json(400, { error: { code: 400, message: "API key not valid." } });
    }
    const visible = (id: string | null) =>
      playlists.find((candidate) => candidate.id === id && candidate.privacyStatus !== "private");

    if (url.pathname === "/youtube/v3/playlists") {
      const playlist = visible(url.searchParams.get("id"));
      return json(200, {
        kind: "youtube#playlistListResponse",
        items:
          playlist === undefined
            ? []
            : [
                {
                  kind: "youtube#playlist",
                  id: playlist.id,
                  snippet: { title: playlist.title, channelTitle: playlist.channelTitle },
                  status: { privacyStatus: playlist.privacyStatus },
                },
              ],
      });
    }

    if (url.pathname === "/youtube/v3/playlistItems") {
      const playlist = visible(url.searchParams.get("playlistId"));
      if (playlist === undefined) {
        return json(404, { error: { code: 404, errors: [{ reason: "playlistNotFound" }] } });
      }
      const start = Number(url.searchParams.get("pageToken") ?? "0");
      const page = playlist.items.slice(start, start + PAGE_SIZE);
      const next = start + PAGE_SIZE < playlist.items.length ? String(start + PAGE_SIZE) : undefined;
      return json(200, {
        kind: "youtube#playlistItemListResponse",
        ...(next === undefined ? {} : { nextPageToken: next }),
        pageInfo: { totalResults: playlist.items.length, resultsPerPage: PAGE_SIZE },
        items: page.map((item) => ({
          kind: "youtube#playlistItem",
          snippet: {
            publishedAt: item.addedAt ?? "2026-09-01T09:00:00Z",
            title: item.title,
            ...(item.privacyStatus === "private" || item.title === "Deleted video"
              ? {}
              : {
                  thumbnails: { default: { url: `https://i.ytimg.com/vi/${item.videoId}/default.jpg` }, medium: { url: `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg` } },
                  videoOwnerChannelTitle: item.channel ?? playlist.channelTitle,
                }),
            resourceId: { kind: "youtube#video", videoId: item.videoId },
          },
          status: { privacyStatus: item.privacyStatus ?? "public" },
        })),
      });
    }
    return json(404, { error: { code: 404 } });
  };

  return { youTubeFetch, requests };
}
