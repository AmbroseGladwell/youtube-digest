import { describe, expect, it } from "vitest";
import { VideoId, type PodcastEpisode, type StoredTranscript } from "@overview/domain";
import { SyncRequestError, type PodcastTranscriptAsk } from "@overview/sync";
import { TranscriptFetchError, type YouTubeFetch } from "@overview/transcripts";
import { podcastTranscript } from "./podcastTranscript.js";

const episode: PodcastEpisode = {
  feedUrl: "https://feeds.example/show.xml",
  guid: "ep-guid",
  title: "241. Susie Wiles Out, Stephen Miller In: What Happens Now?",
  showName: "The Rest Is Politics: US",
  publishedAt: "2026-11-10T06:00:00.000Z",
  durationSeconds: 2184,
  audioUrl: "https://media.example/ep.mp3",
  pageUrl: null,
  imageUrl: null,
  notes: "",
  notesKeywords: [],
  transcripts: [],
  chaptersUrl: null,
  linkFrom: "apple",
};

const transcript: StoredTranscript = {
  videoId: VideoId.parse("podcast:0123456789abcdef0123456789abcdef"),
  segments: [{ text: "Welcome back.", startMs: 0, endMs: 1500 }],
  generated: true,
  fetchedAt: "2026-11-13T09:00:00.000Z",
};

const unavailable = (details: Record<string, unknown>) => new SyncRequestError("transcript_unavailable", 422, "no transcript", details);

const apiAnswering = (answer: (ask: PodcastTranscriptAsk) => StoredTranscript | Error) => {
  const asked: PodcastTranscriptAsk[] = [];
  return {
    asked,
    api: {
      transcript: async (ask: PodcastTranscriptAsk) => {
        asked.push(ask);
        const result = answer(ask);
        if (result instanceof Error) throw result;
        return result;
      },
    },
  };
};

const uploadsWith = (title: string, length: string) => ({
  contents: [
    {
      lockupViewModel: {
        contentId: "VIDEO000001",
        contentImage: {
          thumbnailViewModel: {
            overlays: [{ thumbnailBottomOverlayViewModel: { badges: [{ thumbnailBadgeViewModel: { text: length } }] } }],
          },
        },
        metadata: {
          lockupMetadataViewModel: {
            title: { content: title },
            metadata: { contentMetadataViewModel: { metadataRows: [{ metadataParts: [{ text: { content: "3 days ago" } }] }] } },
          },
        },
      },
    },
  ],
});

const youTubeFinding =
  (title: string, length = "36:10"): YouTubeFetch =>
  async ({ url }) => {
    if (url.endsWith("/search"))
      return {
        status: 200,
        body: JSON.stringify({ channelRenderer: { channelId: "UCshow", title: { simpleText: "The Rest Is Politics US" } } }),
      };
    if (url.endsWith("/browse")) return { status: 200, body: JSON.stringify(uploadsWith(title, length)) };
    return { status: 404, body: "" };
  };

describe("podcastTranscript", () => {
  it("answers from our server's cache or the feed's own transcript without touching YouTube", async () => {
    const { api, asked } = apiAnswering(() => transcript);
    const youTubeFetch: YouTubeFetch = async () => {
      throw new Error("YouTube should not be asked");
    };
    await expect(podcastTranscript(api, episode, youTubeFetch)).resolves.toEqual({ transcript, keptForEveryone: true });
    expect(asked).toEqual([{ feedUrl: episode.feedUrl, guid: episode.guid }]);
  });

  it("finds the episode with the extension and has our server check the video it found", async () => {
    const { api, asked } = apiAnswering((ask) => (ask.youTubeVideoId === undefined ? unavailable({ failure: "no-captions" }) : transcript));
    const result = await podcastTranscript(api, episode, youTubeFinding("Susie Wiles Out, Stephen Miller In: What Happens Now?"));
    expect(result).toEqual({ transcript, keptForEveryone: true });
    expect(asked[1]).toEqual({ feedUrl: episode.feedUrl, guid: episode.guid, youTubeVideoId: "VIDEO000001" });
  });

  it("asks our server to search when there is no extension", async () => {
    const { api, asked } = apiAnswering((ask) => (ask.searchYouTube === true ? transcript : unavailable({ failure: "no-captions" })));
    await expect(podcastTranscript(api, episode, null)).resolves.toEqual({ transcript, keptForEveryone: true });
    expect(asked[1]).toEqual({ feedUrl: episode.feedUrl, guid: episode.guid, searchYouTube: true });
  });

  it("says there are no captions when the extension looked and the episode isn't there, without asking our server to look again", async () => {
    const { api, asked } = apiAnswering(() => unavailable({ failure: "no-captions" }));
    const error = await podcastTranscript(api, episode, youTubeFinding("Something else", "5:00")).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TranscriptFetchError);
    expect((error as TranscriptFetchError).failure).toBe("no-captions");
    expect(asked).toHaveLength(1);
  });

  it("falls back to our server's search when YouTube turned the extension away", async () => {
    const { api, asked } = apiAnswering((ask) => (ask.searchYouTube === true ? transcript : unavailable({ failure: "no-captions" })));
    const blocked: YouTubeFetch = async () => ({ status: 403, body: "" });
    await expect(podcastTranscript(api, episode, blocked)).resolves.toEqual({ transcript, keptForEveryone: true });
    expect(asked.at(-1)?.searchYouTube).toBe(true);
  });

  it("passes on the server's named failure, such as a feed that couldn't be read", async () => {
    const { api } = apiAnswering(() => unavailable({ failure: "source-unavailable" }));
    const error = await podcastTranscript(api, episode, null).catch((caught: unknown) => caught);
    expect((error as TranscriptFetchError).failure).toBe("source-unavailable");
  });
});
