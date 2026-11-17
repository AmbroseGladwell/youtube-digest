import { describe, expect, it } from "vitest";
import type { PodcastEpisode, TranscriptCheck } from "@overview/domain";
import type { PodcastTranscriptAsk } from "@overview/sync";
import type { YouTubeFetch } from "@overview/transcripts";
import { checkEpisodeWords } from "./checkEpisodeWords.js";

const episode = {
  feedUrl: "https://feeds.example/show.xml",
  guid: "ep-guid",
  title: "An episode",
  showName: "A Show",
  publishedAt: null,
  durationSeconds: 1800,
  notesKeywords: [],
} as unknown as PodcastEpisode;

const NONE: TranscriptCheck = {
  words: "none",
  transcription: { status: "needed", episodeSeconds: 1800, usage: { usedSeconds: 0, limitSeconds: 18000, episodes: 0 } },
};

const answering = (answer: TranscriptCheck) => {
  const asked: PodcastTranscriptAsk[] = [];
  return {
    asked,
    api: {
      checkTranscript: async (ask: PodcastTranscriptAsk) => {
        asked.push(ask);
        return answer;
      },
    },
  };
};

describe("checkEpisodeWords", () => {
  it("asks our server to search when there's no extension", async () => {
    const { api, asked } = answering(NONE);
    await expect(checkEpisodeWords(api, episode, null)).resolves.toEqual(NONE);
    expect(asked).toEqual([{ feedUrl: episode.feedUrl, guid: episode.guid, searchYouTube: true }]);
  });

  it("with an extension, asks our server first, and doesn't look on YouTube when the words are already there", async () => {
    const { api, asked } = answering({ words: "found" });
    const youTubeFetch: YouTubeFetch = async () => {
      throw new Error("YouTube should not be asked");
    };
    await expect(checkEpisodeWords(api, episode, youTubeFetch)).resolves.toEqual({ words: "found" });
    expect(asked).toEqual([{ feedUrl: episode.feedUrl, guid: episode.guid }]);
  });

  it("can't tell when the extension's look on YouTube fails, so Create looks again", async () => {
    const { api } = answering(NONE);
    const failing: YouTubeFetch = async () => {
      throw new Error("offline");
    };
    await expect(checkEpisodeWords(api, episode, failing)).resolves.toEqual({ words: "unknown" });
  });
});
