import { describe, expect, it } from "vitest";
import { VideoId, type PodcastEpisode, type PodcastTranscription, type StoredTranscript } from "@overview/domain";
import { SyncRequestError } from "@overview/sync";
import { transcribeEpisode } from "./transcribeEpisode.js";
import { TranscriptionFailedError } from "./TranscriptionFailedError.js";
import { TranscriptionRefusedError } from "./TranscriptionRefusedError.js";

const episode = { feedUrl: "https://feeds.example/show.xml", guid: "ep-guid" } as PodcastEpisode;
const ID = "0b6f1a4e-6a43-4c39-9a3e-1d2f0f6d2a11";
const transcript: StoredTranscript = {
  videoId: VideoId.parse("podcast:0123456789abcdef0123456789abcdef"),
  segments: [{ text: "Welcome back.", startMs: 0, endMs: 1500 }],
  generated: true,
  fetchedAt: "2026-11-16T09:00:00.000Z",
};

const scripted = (first: PodcastTranscription | Error, ...then: (PodcastTranscription | Error)[]) => ({
  transcribe: async () => {
    if (first instanceof Error) throw first;
    return first;
  },
  transcription: async () => {
    const next = then.length > 1 ? then.shift()! : then[0]!;
    if (next instanceof Error) throw next;
    return next;
  },
});

const noWait = async () => undefined;

describe("transcribeEpisode", () => {
  it("waits for a card, then for the words, saying each once", async () => {
    const progress: string[] = [];
    const api = scripted(
      { status: "waiting", id: ID, episodeSeconds: 1800 },
      { status: "waiting", id: ID, episodeSeconds: null },
      { status: "transcribing", id: ID, episodeSeconds: null },
      { status: "transcribing", id: ID, episodeSeconds: null },
      { status: "ready", id: ID, transcript },
    );
    await expect(transcribeEpisode(api, episode, { onProgress: (p) => progress.push(p), sleep: noWait })).resolves.toEqual({ transcript });
    expect(progress).toEqual(["starting", "transcribing"]);
  });

  it("fails with the server's reason, and carries on past a poll the connection dropped", async () => {
    const api = scripted({ status: "waiting", id: ID, episodeSeconds: 1800 }, new Error("offline"), {
      status: "failed",
      id: ID,
      reason: "no-transcriber",
    });
    const error = await transcribeEpisode(api, episode, { sleep: noWait }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TranscriptionFailedError);
    expect((error as TranscriptionFailedError).reason).toBe("no-transcriber");
  });

  it("says when our server won't start it: the month's hours are spent, or it's too long", async () => {
    const spent = scripted(new SyncRequestError("too_many_requests", 429, "spent", { quota: "transcription" }));
    const tooLong = scripted(
      new SyncRequestError("transcript_unavailable", 422, "too long", { transcription: "too-long", episodeSeconds: 16_680 }),
    );
    const refusedSpent = await transcribeEpisode(spent, episode, { sleep: noWait }).catch((caught: unknown) => caught);
    const refusedLong = await transcribeEpisode(tooLong, episode, { sleep: noWait }).catch((caught: unknown) => caught);
    expect(refusedSpent).toMatchObject({ refusal: "not-enough" });
    expect(refusedLong).toBeInstanceOf(TranscriptionRefusedError);
    expect(refusedLong).toMatchObject({ refusal: "too-long", episodeSeconds: 16_680 });
  });
});
