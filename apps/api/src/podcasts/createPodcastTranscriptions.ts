import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, type Plan, type PodcastTranscription, type TranscriptionOffer, type TranscriptionUsage } from "@overview/domain";
import type { createPublicWebFetch } from "../publicWeb/createPublicWebFetch.js";
import { callerKey, type ServiceCaller } from "../transcripts/ServiceTranscripts.js";
import { secondsToNextUsageMonth } from "../usage/usageMonth.js";
import { feedItemGuid, fetchFeedEpisode } from "./fetchFeedEpisode.js";
import { podcastSourceKey } from "./createPodcastTranscripts.js";
import type { PodcastTranscriptionJob, PodcastTranscriptionsRepository } from "./PodcastTranscriptionsRepository.js";
import type { TranscriptionQueue } from "./TranscriptionQueue.js";

const HOUR = 3600;

// A guard against misuse more than a cost, at about a cent an hour (OV-305).
export const transcriptionHours = { free: 5, "byo-plus": 15, plus: 30 } as const satisfies Record<Plan, number>;
export const LONGEST_EPISODE_SECONDS = 4 * HOUR;
// A feed's length is the publisher's word, so the audio itself may run a little past it.
const MEASURED_SLACK_SECONDS = 10 * 60;
const HELD_SECONDS_WITHOUT_FEED_LENGTH = HOUR;

export type AudioStart =
  | { status: "started"; transcription: PodcastTranscription }
  | { status: "over-allowance"; usedSeconds: number; limitSeconds: number; retryAfterSeconds: number }
  | { status: "too-long"; episodeSeconds: number }
  | { status: "no-audio" };

export type TranscriptionStart = AudioStart | { status: "feed-unreadable" } | { status: "not-in-feed" };

export interface EpisodeAudio {
  sourceKey: string;
  durationSeconds: number | null;
  audioUrl: string | null;
}

export interface PodcastTranscriptionsOptions {
  fetchPublicWeb: ReturnType<typeof createPublicWebFetch>;
  jobs: PodcastTranscriptionsRepository;
  queue: TranscriptionQueue;
  clock: () => Date;
}

// Why signed out counts as Free: docs/features/speech-to-text.md, "The server rung".
const limitSecondsOf = (caller: ServiceCaller): number => transcriptionHours["accountId" in caller ? caller.plan : "free"] * HOUR;

const shown = (job: PodcastTranscriptionJob, episodeSeconds: number | null): PodcastTranscription => {
  if (job.status === "ready") {
    return { status: "ready", id: job.id, transcript: job.transcript! };
  }
  if (job.status === "failed") {
    return { status: "failed", id: job.id, reason: job.failure ?? "failed" };
  }
  return { status: job.status === "transcribing" ? "transcribing" : "waiting", id: job.id, episodeSeconds };
};

// Why the audio sent is the feed's own: docs/features/speech-to-text.md, "The server rung".
export const createPodcastTranscriptions = ({ fetchPublicWeb, jobs, queue, clock }: PodcastTranscriptionsOptions) => {
  const usage = async (now: Date, caller: ServiceCaller): Promise<TranscriptionUsage> => ({
    ...(await jobs.usage(now, callerKey(caller))),
    limitSeconds: limitSecondsOf(caller),
  });

  const offer = async (episode: EpisodeAudio, caller: ServiceCaller): Promise<TranscriptionOffer> => {
    if (episode.audioUrl === null) {
      return { status: "no-audio" };
    }
    const episodeSeconds = episode.durationSeconds;
    if (episodeSeconds !== null && episodeSeconds > LONGEST_EPISODE_SECONDS) {
      return { status: "too-long", episodeSeconds };
    }
    const existing = await jobs.find(callerKey(caller), episode.sourceKey);
    if (existing !== null && existing !== "failed") {
      return { status: "free", why: existing === "ready" ? "transcribed" : "on-its-way" };
    }
    const month = await usage(clock(), caller);
    const needs = Math.min(episodeSeconds ?? 1, LONGEST_EPISODE_SECONDS);
    return { status: month.usedSeconds + needs <= month.limitSeconds ? "needed" : "not-enough", episodeSeconds, usage: month };
  };

  // Any source's audio, once our server has found it itself: never an address a caller sent.
  const startAudio = async (audio: EpisodeAudio, caller: ServiceCaller, log: FastifyBaseLogger): Promise<AudioStart> => {
    const episodeSeconds = audio.durationSeconds;
    if (audio.audioUrl === null) {
      log.info(apiLogLines.transcription.refused({ reason: "no-audio" }));
      return { status: "no-audio" };
    }
    if (episodeSeconds !== null && episodeSeconds > LONGEST_EPISODE_SECONDS) {
      log.info(apiLogLines.transcription.refused({ reason: "too-long", episodeSeconds }));
      return { status: "too-long", episodeSeconds };
    }
    const now = clock();
    const key = callerKey(caller);
    const limitSeconds = limitSecondsOf(caller);
    const reserveSeconds = Math.min(episodeSeconds ?? HELD_SECONDS_WITHOUT_FEED_LENGTH, LONGEST_EPISODE_SECONDS);
    const asked = await jobs.request({
      id: randomUUID(),
      caller: key,
      accountId: "accountId" in caller ? caller.accountId : null,
      sourceKey: audio.sourceKey,
      audioUrl: audio.audioUrl,
      maxSeconds: LONGEST_EPISODE_SECONDS + MEASURED_SLACK_SECONDS,
      reserveSeconds,
      limitSeconds,
      now,
    });
    if (asked.outcome === "over-allowance") {
      log.info(apiLogLines.transcription.refused({ reason: "allowance", usedSeconds: asked.usedSeconds, limitSeconds }));
      return { status: "over-allowance", usedSeconds: asked.usedSeconds, limitSeconds, retryAfterSeconds: secondsToNextUsageMonth(now) };
    }
    if (asked.outcome === "queued") {
      log.info(
        apiLogLines.transcription.requested({
          caller: "accountId" in caller ? "account" : "address",
          plan: "accountId" in caller ? caller.plan : null,
          episodeSeconds,
          reservedSeconds: reserveSeconds,
        }),
      );
      queue.kick();
    }
    return { status: "started", transcription: shown(asked.job, episodeSeconds) };
  };

  const start = async (feedUrl: string, guid: string, caller: ServiceCaller, log: FastifyBaseLogger): Promise<TranscriptionStart> => {
    const read = await fetchFeedEpisode(fetchPublicWeb, feedUrl, (item) => feedItemGuid(item) === guid);
    if (read.status === "failed") {
      return { status: "feed-unreadable" };
    }
    const { item } = read.feed;
    if (item === null) {
      return { status: "not-in-feed" };
    }
    const sourceKey = await podcastSourceKey({ feedUrl, guid });
    return startAudio({ sourceKey, durationSeconds: item.durationSeconds, audioUrl: item.audioUrl }, caller, log);
  };

  const status = async (id: string, caller: ServiceCaller): Promise<PodcastTranscription | null> => {
    const job = await jobs.get(id, callerKey(caller));
    return job === null ? null : shown(job, null);
  };

  return { start, startAudio, status, offer, usage };
};
