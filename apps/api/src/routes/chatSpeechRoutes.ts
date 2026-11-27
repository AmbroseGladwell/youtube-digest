import { Readable } from "node:stream";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { z } from "zod";
import {
  apiLogLines,
  chatConversationId,
  chatOwnerOfId,
  redactErrorMessage,
  SPEECH_WARM_PATH,
  spokenAnswer,
  type ChatSpeechEvent,
  type Plan,
} from "@overview/domain";
import { TTS_RENDER_VERSION } from "../audio/audioKey.js";
import type { AccountId } from "../auth/AccountId.js";
import { accountPlan } from "../auth/accountPlan.js";
import type { AccountCostsRepository } from "../costs/AccountCostsRepository.js";
import type { SqlClient } from "../db/SqlClient.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { readChat } from "../mcp/readChats.js";
import { readSettings } from "../records/readSettings.js";
import type { RecordsRepository } from "../records/RecordsRepository.js";
import type { HostSeconds, LiveSpeechLane, LiveSpeechOutcome, LiveSpeechWarmUp } from "../speech/LiveSpeechLane.js";
import { speechDetail, speechDollars, type HostPrices } from "../speech/speechCost.js";
import { NdjsonChannel } from "../speech/NdjsonChannel.js";
import { DEFAULT_CHUNK_SIZING, speechChunks, type ChunkSizing } from "../speech/speechChunks.js";
import { secondsToNextUsageDay } from "../transcripts/ServiceUsageRepository.js";
import type { ChatUsageRepository } from "../usage/ChatUsageRepository.js";
import { nextUsageMonth, secondsToNextUsageMonth } from "../usage/usageMonth.js";

const SpeechParams = z.object({
  id: z.string().refine((id) => chatOwnerOfId(id) !== null && z.uuid().safeParse(chatConversationId(id)).success, "not a chat's id"),
  index: z.coerce.number().int().nonnegative(),
});

const UNITS_PER_DOLLAR = 1_000_000;
const NO_VOICE = "This server has no voice";

export interface ChatSpeech {
  lane: LiveSpeechLane;
  prices: HostPrices;
  sizing?: ChunkSizing;
}

export interface ChatSpeechRoutesOptions {
  speech: ChatSpeech | null;
  records: RecordsRepository;
  usage: ChatUsageRepository;
  costs: AccountCostsRepository;
  sql: SqlClient;
  clock: () => Date;
}

interface Payer {
  accountId: AccountId;
  plan: Plan;
}

// How a play becomes usage and cost: docs/features/chat-read-aloud.md, "What a play costs".
export const chatSpeechRoutes = (app: FastifyInstance, { speech, records, usage, costs, sql, clock }: ChatSpeechRoutesOptions): void => {
  const charge = async ({ accountId }: Payer, machineSeconds: HostSeconds, detail: string, log: FastifyBaseLogger): Promise<number> => {
    if (speech === null) {
      return 0;
    }
    let units = 0;
    for (const host of ["modal", "fly"] as const) {
      const price = speech.prices[host];
      const seconds = machineSeconds[host];
      if (price === null || seconds <= 0) {
        continue;
      }
      const dollars = speechDollars(seconds, price);
      units += Math.round(dollars * UNITS_PER_DOLLAR);
      await costs.recordOrLog(
        clock(),
        { accountId },
        { area: "speech", detail: speechDetail(detail, host), quantity: seconds, dollars },
        log,
      );
    }
    await usage.spendOnSpeech(clock(), accountId, units);
    return units;
  };

  const refuseWhenSpent = async ({ accountId, plan }: Payer, log: FastifyBaseLogger): Promise<void> => {
    const now = clock();
    const refusal = await usage.speechRefusal(now, accountId, plan);
    if (refusal === null) {
      return;
    }
    log.info(apiLogLines.speech.allowanceSpent({ plan, ...refusal }));
    throw refusal.quota === "day"
      ? new ApiError("too_many_requests", "That's the most chat for one day.", {
          quota: "chat-day",
          retryAfterSeconds: secondsToNextUsageDay(now),
        })
      : new ApiError("too_many_requests", "You've used this month's chat.", {
          quota: "chat-month",
          resetsOn: nextUsageMonth(now),
          retryAfterSeconds: secondsToNextUsageMonth(now),
        });
  };

  const payerOf = async (accountId: AccountId): Promise<Payer> => ({ accountId, plan: await accountPlan(sql, accountId) });

  app.post(SPEECH_WARM_PATH, async (request, reply) => {
    if (speech === null) {
      throw new ApiError("unavailable", NO_VOICE);
    }
    const payer = await payerOf(request.session!.accountId);
    await refuseWhenSpent(payer, request.log);
    const { machineSeconds, warmed, host } = await speech.lane
      .warm()
      .catch((): LiveSpeechWarmUp => ({ machineSeconds: 0, warmed: false, host: null }));
    const usageUnits = host === null ? 0 : await charge(payer, { fly: 0, modal: 0, [host]: machineSeconds }, "chat-warm", request.log);
    request.log.info(apiLogLines.speech.warmed({ plan: payer.plan, warmed, host, machineSeconds, usageUnits }));
    return reply.status(204).send();
  });

  app.post("/chat-records/:id/messages/:index/speech", async (request, reply) => {
    const { id, index } = parseOrThrow(SpeechParams, request.params, "The answer");
    if (speech === null) {
      throw new ApiError("unavailable", NO_VOICE);
    }
    const payer = await payerOf(request.session!.accountId);
    const message = (await readChat(sql, payer.accountId, id))?.messages[index];
    if (message?.from !== "answer") {
      throw new ApiError("not_found", "No such answer");
    }
    await refuseWhenSpent(payer, request.log);
    const settings = await readSettings(records, payer.accountId);
    if (settings === null) {
      throw new ApiError("unavailable", "Your settings couldn't be read");
    }
    const sentences = spokenAnswer(message);
    const chunks = speechChunks(sentences, ({ spoken }) => spoken.length, speech.sizing ?? DEFAULT_CHUNK_SIZING);
    const channel = new NdjsonChannel<ChatSpeechEvent>();
    channel.push({ type: "sentences", sentences: sentences.map(({ place, block, start, end }) => ({ place, block, start, end })) });
    const firsts = chunks.map((_, at) => chunks.slice(0, at).reduce((sum, chunk) => sum + chunk.length, 0));
    const stop = new AbortController();
    const requestedAt = clock();
    let firstAudioSeconds: number | null = null;
    request.raw.on("close", () => stop.abort());

    const played = speech.lane.play({
      voice: settings.narrationVoice,
      renderVersion: TTS_RENDER_VERSION,
      chunks: chunks.map((chunk) => chunk.map(({ spoken }) => spoken)),
      signal: stop.signal,
      onChunk: async (at, narration) => {
        const range = { first: firsts[at]!, count: chunks[at]!.length };
        if (narration === null) {
          channel.push({ type: "skipped", ...range });
          return;
        }
        firstAudioSeconds ??= (clock().getTime() - requestedAt.getTime()) / 1000;
        channel.push({
          type: "audio",
          ...range,
          sentenceStartsSeconds: narration.lineStartsSeconds,
          durationSeconds: narration.durationSeconds,
          audioBase64: narration.audio.toString("base64"),
        });
      },
    });

    void played
      .then(async (outcome: LiveSpeechOutcome) => {
        const usageUnits = await charge(payer, outcome.machineSeconds, "chat", request.log);
        if (!stop.signal.aborted) {
          channel.push({ type: "done" });
        }
        channel.close();
        request.log.info(
          apiLogLines.speech.played({
            plan: payer.plan,
            voice: settings.narrationVoice,
            sentences: sentences.length,
            chunks: chunks.length,
            firstChunkCharacters: chunks[0]?.reduce((sum, { spoken }) => sum + spoken.length, 0) ?? 0,
            ...outcome,
            stopped: stop.signal.aborted,
            firstAudioSeconds,
            usageUnits,
            priced: speech.prices.fly !== null || speech.prices.modal !== null,
          }),
        );
      })
      .catch((error: unknown) => {
        channel.close();
        request.log.error(apiLogLines.speech.chargeFailed({ error: redactErrorMessage(String(error)) }));
      });

    return reply
      .header("content-type", "application/x-ndjson; charset=utf-8")
      .header("cache-control", "no-store")
      .send(Readable.from(channel.lines()));
  });
};
