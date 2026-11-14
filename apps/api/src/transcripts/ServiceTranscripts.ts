import type { FastifyBaseLogger } from "fastify";
import { apiLogLines, StoredTranscript, type Plan, type VideoId } from "@overview/domain";
import { TranscriptFetchError, TranscriptFetchFailure, type YouTubeFetch } from "@overview/transcripts";
import type { AccountCostsRepository, CostPayer } from "../costs/AccountCostsRepository.js";
import type { AccountId } from "../auth/AccountId.js";
import { hashedAddress } from "../http/hashedAddress.js";
import {
  fetchThroughService,
  throughService,
  type ProxyBudget,
  type ServiceFetches,
  type ServiceFetchResult,
} from "./fetchThroughService.js";
import { secondsToNextUsageDay, type FetchReservation, type ServiceUsageRepository } from "./ServiceUsageRepository.js";
import { shareableTranscript } from "./shareableTranscript.js";
import { transcriptFault } from "./transcriptFault.js";

const MISSING_TTL_MS = 6 * 60 * 60 * 1000;

export const PROXY_PRICE = {
  dollarsPerGb: 4,
  checkedOn: "2026-11-10",
  source: "Decodo residential, pay as you go (docs/architecture/server-side-transcripts.md)",
};
const BYTES_PER_GB = 1e9;

// A daily safety cap per caller on cold fetches, well above normal use: it protects our
// address's standing with YouTube, not our money (docs/architecture/server-side-transcripts.md,
// "Limits").
export const serviceTranscriptQuotas = { address: 5, free: 50, "byo-plus": 100, plus: 100 } as const satisfies Record<
  "address" | Plan,
  number
>;

export type ServiceCaller = { accountId: AccountId; plan: Plan } | { address: string };

export interface ServiceTranscriptsOptions {
  fetches: ServiceFetches;
  usage: ServiceUsageRepository;
  costs: AccountCostsRepository;
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

export type ServiceAnswer = { transcript: StoredTranscript; via: ServiceFetchResult["via"] };

const callerKey = (caller: ServiceCaller): string =>
  "accountId" in caller ? `account:${caller.accountId}` : `address:${hashedAddress(caller.address)}`;

const quotaOf = (caller: ServiceCaller): number =>
  "accountId" in caller ? serviceTranscriptQuotas[caller.plan] : serviceTranscriptQuotas.address;

const callerLogged = (caller: ServiceCaller) =>
  "accountId" in caller
    ? { caller: "account" as const, plan: caller.plan, accountId: caller.accountId }
    : { caller: "address" as const, plan: null };

// The last rung: asked only once every rung a client holds has failed. It fetches the captions
// for the reader who asked and keeps nothing for anyone else: their device keeps them, and
// uploads them to their own account (OV-295). Readers asking for the same video at the same
// moment share the one fetch in flight (docs/architecture/server-side-transcripts.md).
export class ServiceTranscripts {
  #options: ServiceTranscriptsOptions;
  #inFlight = new Map<VideoId, Promise<ServiceAnswer>>();
  #missing = new Map<VideoId, { error: TranscriptFetchError; until: number }>();

  constructor(options: ServiceTranscriptsOptions) {
    this.#options = options;
  }

  async resolve(videoId: VideoId, caller: ServiceCaller, log: FastifyBaseLogger): Promise<ServiceAnswer> {
    const { usage, clock } = this.#options;

    const now = clock();
    const missing = this.#missing.get(videoId);
    if (missing !== undefined && missing.until > now.getTime()) throw missing.error;

    // A fetch already under way for this video is joined for free, never kept afterwards,
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
        const retryAfterSeconds = secondsToNextUsageDay(now);
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
        return await this.#fetch(videoId, "accountId" in caller ? { accountId: caller.accountId } : "signed-out", log, reservation);
      } catch (error) {
        await usage.releaseFetch(clock(), key);
        throw error;
      }
    })().finally(() => this.#inFlight.delete(videoId));
    this.#inFlight.set(videoId, fetching);
    return fetching;
  }

  // Any YouTube request on our server's behalf, the same way a caption fetch goes: our own
  // address first, then the proxy within today's budget, its bytes recorded against the payer
  // (docs/features/podcast-on-youtube.md, "Our server's part").
  async onYouTube<T>(operation: (youTubeFetch: YouTubeFetch) => Promise<T>, payer: CostPayer, log: FastifyBaseLogger): Promise<T> {
    return (await throughService(this.#options.fetches, this.#budget(payer, log), operation)).value;
  }

  #budget(payer: CostPayer, log: FastifyBaseLogger, onSpent: (bytes: number) => void = () => undefined): ProxyBudget {
    const { usage, costs, proxyDailyFetches, clock } = this.#options;
    return {
      reserve: () => usage.reserveProxy(clock(), proxyDailyFetches),
      release: () => usage.releaseProxy(clock()),
      spend: async (bytes) => {
        onSpent(bytes);
        const today = await usage.addProxyBytes(clock(), bytes);
        await costs.recordOrLog(
          clock(),
          payer,
          { area: "transcripts", detail: "proxy", quantity: bytes, dollars: (bytes / BYTES_PER_GB) * PROXY_PRICE.dollarsPerGb },
          log,
        );
        log.info(
          apiLogLines.serviceTranscripts.proxySpend({ proxyBytes: bytes, proxiedToday: today.proxied, proxyBytesToday: today.proxyBytes }),
        );
      },
    };
  }

  async #fetch(videoId: VideoId, payer: CostPayer, log: FastifyBaseLogger, reservation: FetchReservation): Promise<ServiceAnswer> {
    const { fetches, clock } = this.#options;
    const startedAt = clock().getTime();
    let proxyBytes = 0;
    let result: ServiceFetchResult;
    try {
      result = await fetchThroughService(
        fetches,
        this.#budget(payer, log, (bytes) => {
          proxyBytes = bytes;
        }),
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
