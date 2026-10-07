import { createHash } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, StoredTranscript, type Plan, type VideoId } from "@overview/domain";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import type { AccountId } from "../auth/AccountId.js";
import { fetchThroughService, type ServiceFetches, type ServiceFetchResult } from "./fetchThroughService.js";
import type { FetchReservation, ServiceUsageRepository } from "./ServiceUsageRepository.js";
import { shareableTranscript } from "./shareableTranscript.js";
import { transcriptFault } from "./transcriptFault.js";
import type { TranscriptsRepository } from "./TranscriptsRepository.js";

const MISSING_TTL_MS = 6 * 60 * 60 * 1000;

// A daily safety cap per caller on cold fetches, well above normal use: it protects our
// address's standing with YouTube, not our money. A shared-cache hit costs nothing and is
// never counted (docs/architecture/server-side-transcripts.md, "Limits").
export const serviceTranscriptQuotas = { address: 5, free: 50, plus: 100 } as const satisfies Record<
  "address" | Plan,
  number
>;

export type ServiceCaller = { accountId: AccountId; plan: Plan } | { address: string };

export interface ServiceTranscriptsOptions {
  fetches: ServiceFetches;
  usage: ServiceUsageRepository;
  transcripts: TranscriptsRepository;
  proxyDailyFetches: number;
  clock: () => Date;
}

export class QuotaSpentError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Our server has fetched as many transcripts for you as it can today");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type ServiceAnswer = { transcript: StoredTranscript; via: "cache" | ServiceFetchResult["via"] };

const callerKey = (caller: ServiceCaller): string =>
  "accountId" in caller
    ? `account:${caller.accountId}`
    : `address:${createHash("sha256").update(caller.address).digest("hex").slice(0, 32)}`;

const quotaOf = (caller: ServiceCaller): number =>
  "accountId" in caller ? serviceTranscriptQuotas[caller.plan] : serviceTranscriptQuotas.address;

const callerLogged = (caller: ServiceCaller) =>
  "accountId" in caller
    ? { caller: "account" as const, plan: caller.plan, accountId: caller.accountId }
    : { caller: "address" as const, plan: null };

const secondsToNextDay = (now: Date): number => {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
};

// The last rung: asked only once every rung a client holds has failed, it answers from the
// shared cache when it can, fetches once per video however many readers ask at the same
// moment, and adds what it fetched to the cache as confirmed, since nobody but us touched
// it (docs/architecture/server-side-transcripts.md).
export class ServiceTranscripts {
  #options: ServiceTranscriptsOptions;
  #inFlight = new Map<VideoId, Promise<ServiceAnswer>>();
  #missing = new Map<VideoId, { error: TranscriptFetchError; until: number }>();

  constructor(options: ServiceTranscriptsOptions) {
    this.#options = options;
  }

  async resolve(videoId: VideoId, caller: ServiceCaller, log: FastifyBaseLogger): Promise<ServiceAnswer> {
    const { transcripts, usage, clock } = this.#options;
    const shared = StoredTranscript.safeParse(await transcripts.getShared(videoId));
    if (shared.success && shared.data.video !== undefined) return { transcript: shared.data, via: "cache" };

    const now = clock();
    const missing = this.#missing.get(videoId);
    if (missing !== undefined && missing.until > now.getTime()) throw missing.error;

    // A fetch already under way for this video is the cache a moment early: joined for free,
    // and only the caller who started it holds a slot. Its cap is its own, so a joiner it
    // refused asks again for itself.
    const running = this.#inFlight.get(videoId);
    if (running !== undefined) {
      try {
        return await running;
      } catch (error) {
        if (error instanceof QuotaSpentError) return this.resolve(videoId, caller, log);
        throw error;
      }
    }

    const key = callerKey(caller);
    const fetching = (async (): Promise<ServiceAnswer> => {
      const reservation = await usage.reserveFetch(now, key, quotaOf(caller));
      if (!reservation.reserved) {
        const retryAfterSeconds = secondsToNextDay(now);
        log.warn(
          apiLogLines.serviceTranscripts.quotaSpent({
            ...callerLogged(caller),
            limit: reservation.limit,
            used: reservation.used,
            retryAfterSeconds,
          }),
        );
        throw new QuotaSpentError(retryAfterSeconds);
      }
      try {
        return await this.#fetch(videoId, log, reservation);
      } catch (error) {
        await usage.releaseFetch(clock(), key);
        throw error;
      }
    })().finally(() => this.#inFlight.delete(videoId));
    this.#inFlight.set(videoId, fetching);
    return fetching;
  }

  async #fetch(videoId: VideoId, log: FastifyBaseLogger, reservation: FetchReservation): Promise<ServiceAnswer> {
    const { fetches, usage, transcripts, proxyDailyFetches, clock } = this.#options;
    const startedAt = clock().getTime();
    let proxyBytes = 0;
    let result: ServiceFetchResult;
    try {
      result = await fetchThroughService(
        fetches,
        {
          reserve: () => usage.reserveProxy(clock(), proxyDailyFetches),
          release: () => usage.releaseProxy(clock()),
          spend: async (bytes) => {
            proxyBytes = bytes;
            const today = await usage.addProxyBytes(clock(), bytes);
            log.info(
              apiLogLines.serviceTranscripts.proxySpend({
                proxyBytes: bytes,
                proxiedToday: today.proxied,
                proxyBytesToday: today.proxyBytes,
              }),
            );
          },
        },
        videoId,
      );
    } catch (error) {
      const failed =
        error instanceof TranscriptFetchError
          ? error
          : new TranscriptFetchError("the request failed", { failure: TranscriptFetchFailure.SOURCE_UNAVAILABLE, cause: error });
      if (failed.failure === TranscriptFetchFailure.NO_CAPTIONS || failed.failure === TranscriptFetchFailure.VIDEO_UNAVAILABLE) {
        this.#missing.set(videoId, { error: failed, until: clock().getTime() + MISSING_TTL_MS });
      }
      log.warn(apiLogLines.serviceTranscripts.failed({ failure: failed.failure, proxyBytes, ms: clock().getTime() - startedAt }));
      throw failed;
    }

    const transcript = shareableTranscript({
      videoId,
      segments: result.fetched.transcript,
      generated: result.fetched.generated,
      fetchedAt: clock().toISOString(),
      video: result.fetched.video,
    });
    const fault = transcriptFault(transcript, videoId);
    if (fault !== null) {
      log.warn(apiLogLines.serviceTranscripts.refused({ fault, via: result.via }));
      throw new TranscriptFetchError("YouTube answered with captions that could not be read", {
        failure: TranscriptFetchFailure.MALFORMED_RESPONSE,
        sourceId: "service",
      });
    }
    await transcripts.putServiceFetched(transcript);
    log.info(
      apiLogLines.serviceTranscripts.fetched({
        via: result.via,
        proxySessions: result.proxySessions,
        proxyBytes,
        generated: transcript.generated,
        segments: transcript.segments.length,
        ms: clock().getTime() - startedAt,
        used: reservation.used,
        limit: reservation.limit,
      }),
    );
    return { transcript, via: result.via };
  }
}
