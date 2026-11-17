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

// Hours of audio transcribed a month: a guard against misuse more than a cost, at about a cent an
// hour. A trial's address, making onboarding's one overview, has room for one of the longest
// episodes (OV-305, 16 Nov 2026).
export const transcriptionHours = { address: 4, free: 5, "byo-plus": 15, plus: 30 } as const satisfies Record<"address" | Plan, number>;
export const LONGEST_EPISODE_SECONDS = 4 * HOUR;
// A feed's length is the publisher's word, so the audio itself may run a little past it.
const MEASURED_SLACK_SECONDS = 10 * 60;
// What is held for an episode whose feed gives no length, settled to the audio's own once done.
const UNKNOWN_LENGTH_SECONDS = HOUR;

export type TranscriptionStart =
  | { status: "started"; transcription: PodcastTranscription }
  | { status: "over-allowance"; usedSeconds: number; limitSeconds: number; retryAfterSeconds: number }
  | { status: "too-long"; episodeSeconds: number }
  | { status: "no-audio" }
  | { status: "feed-unreadable" }
  | { status: "not-in-feed" };

// What the episode's feed says, as read for the transcript check.
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

const limitSecondsOf = (caller: ServiceCaller): number =>
  ("accountId" in caller ? transcriptionHours[caller.plan] : transcriptionHours.address) * HOUR;

const shown = (job: PodcastTranscriptionJob, episodeSeconds: number | null): PodcastTranscription => {
  if (job.status === "ready") return { status: "ready", id: job.id, transcript: job.transcript! };
  if (job.status === "failed") return { status: "failed", id: job.id, reason: job.failure ?? "failed" };
  return { status: job.status === "transcribing" ? "transcribing" : "waiting", id: job.id, episodeSeconds };
};

// The last podcast rung, asked only by a reader who chose it once every other rung had failed:
// the episode's own audio, transcribed for them alone. The episode is read again from its feed,
// so the audio sent to the GPU host is the feed's own, never one a caller names
// (docs/features/speech-to-text.md, "The server rung").
export function createPodcastTranscriptions({ fetchPublicWeb, jobs, queue, clock }: PodcastTranscriptionsOptions) {
  const usage = async (now: Date, caller: ServiceCaller): Promise<TranscriptionUsage> => ({
    ...(await jobs.usage(now, callerKey(caller))),
    limitSeconds: limitSecondsOf(caller),
  });

  // Said before the reader chooses, from the feed already read for the check; nothing is held.
  const offer = async (episode: EpisodeAudio, caller: ServiceCaller): Promise<TranscriptionOffer> => {
    if (episode.audioUrl === null) return { status: "no-audio" };
    const episodeSeconds = episode.durationSeconds;
    if (episodeSeconds !== null && episodeSeconds > LONGEST_EPISODE_SECONDS) return { status: "too-long", episodeSeconds };
    const existing = await jobs.find(callerKey(caller), episode.sourceKey);
    if (existing !== null && existing !== "failed") return { status: "free", why: existing === "ready" ? "transcribed" : "on-its-way" };
    const month = await usage(clock(), caller);
    const needs = Math.min(episodeSeconds ?? 1, LONGEST_EPISODE_SECONDS);
    return { status: month.usedSeconds + needs <= month.limitSeconds ? "needed" : "not-enough", episodeSeconds, usage: month };
  };

  const start = async (feedUrl: string, guid: string, caller: ServiceCaller, log: FastifyBaseLogger): Promise<TranscriptionStart> => {
    const read = await fetchFeedEpisode(fetchPublicWeb, feedUrl, (item) => feedItemGuid(item) === guid);
    if (read.status === "failed") return { status: "feed-unreadable" };
    const { item } = read.feed;
    if (item === null) return { status: "not-in-feed" };
    const episodeSeconds = item.durationSeconds;
    if (item.audioUrl === null) {
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
    const reserveSeconds = Math.min(episodeSeconds ?? UNKNOWN_LENGTH_SECONDS, LONGEST_EPISODE_SECONDS);
    const asked = await jobs.request({
      id: randomUUID(),
      caller: key,
      accountId: "accountId" in caller ? caller.accountId : null,
      sourceKey: await podcastSourceKey({ feedUrl, guid }),
      audioUrl: item.audioUrl,
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

  const status = async (id: string, caller: ServiceCaller): Promise<PodcastTranscription | null> => {
    const job = await jobs.get(id, callerKey(caller));
    return job === null ? null : shown(job, null);
  };

  return { start, status, offer, usage };
}
