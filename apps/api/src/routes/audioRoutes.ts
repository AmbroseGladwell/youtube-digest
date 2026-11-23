import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  apiLogLines,
  DEFAULT_NARRATION_VOICE,
  NARRATION_FILE_TYPE,
  NARRATION_SEGMENT_TYPE,
  NarrationVoice,
  SpokenScript,
} from "@overview/domain";
import { AUDIO_KEY_PATTERN, TTS_RENDER_VERSION, audioKey } from "../audio/audioKey.js";
import type { AudioRender, AudioRendersRepository } from "../audio/AudioRendersRepository.js";
import type { AudioRenderQueue } from "../audio/AudioRenderQueue.js";
import type { AudioStore } from "../audio/AudioStore.js";
import type { VoiceSamplesRepository } from "../audio/VoiceSamplesRepository.js";
import { byteRange } from "../audio/byteRange.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";
import { secondsToNextUsageDay } from "../transcripts/ServiceUsageRepository.js";

export const MAX_OUTSTANDING_RENDERS_PER_ACCOUNT = 3;
// Why a daily cap: docs/architecture/tiers.md, "What an own-key overview costs us".
export const MAX_NEW_RENDERS_PER_ACCOUNT_PER_DAY = 30;
export const MAX_KEYS_PER_LOOKUP = 32;

export interface AudioServices {
  renders: AudioRendersRepository;
  queue: AudioRenderQueue;
  store: AudioStore;
  samples: VoiceSamplesRepository;
}

const AudioRequest = z.object({
  lines: SpokenScript,
  voice: NarrationVoice.default(DEFAULT_NARRATION_VOICE),
  priority: z.enum(["interactive", "background"]).default("interactive"),
});

const CONTENT_TYPE = "content-type";
const AUDIO_KEY_LABEL = "The audio key";

const KeyParams = z.object({ key: z.string().regex(AUDIO_KEY_PATTERN) });

const SegmentParams = z.object({
  key: z.string().regex(AUDIO_KEY_PATTERN),
  segment: z
    .string()
    .regex(/^\d{1,5}\.aac$/)
    .transform((name) => Number.parseInt(name, 10)),
});

const AudioLookup = z.object({
  keys: z.array(z.string().regex(AUDIO_KEY_PATTERN)).min(1).max(MAX_KEYS_PER_LOOKUP),
});

const fileUrlOf = (key: string) => `/api/audio/${key}/file`;
const playlistUrlOf = (key: string) => `/api/audio/${key}/playlist.m3u8`;

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

const streamedSoFar = (render: AudioRender) =>
  render.status === "rendering" && render.segmentSeconds !== null && render.segmentSeconds.length > 0
    ? {
        lineStartsSeconds: render.lineStartsSeconds ?? [],
        renderedSeconds: Number(sum(render.segmentSeconds).toFixed(3)),
        playlistUrl: playlistUrlOf(render.key),
      }
    : {};

const describe = (render: AudioRender) => ({
  key: render.key,
  status: render.status,
  ...(render.status === "ready"
    ? {
        lineStartsSeconds: render.lineStartsSeconds,
        durationSeconds: render.durationSeconds,
        fileUrl: fileUrlOf(render.key),
      }
    : streamedSoFar(render)),
});

// A growing HLS playlist of packed-audio segments, closed once the render is ready.
export const playlistOf = (render: AudioRender): string => {
  const segments = render.segmentSeconds ?? [];
  return [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    `#EXT-X-TARGETDURATION:${Math.max(1, Math.ceil(Math.max(0, ...segments)))}`,
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:EVENT",
    "#EXT-X-START:TIME-OFFSET=0,PRECISE=YES",
    ...segments.flatMap((seconds, index) => [`#EXTINF:${seconds.toFixed(6)},`, `segments/${index}.aac`]),
    ...(render.status === "ready" ? ["#EXT-X-ENDLIST"] : []),
    "",
  ].join("\n");
};

const sendRanged = (rangeHeader: string | undefined, body: Buffer, reply: FastifyReply) => {
  reply.header("accept-ranges", "bytes");
  const range = byteRange(rangeHeader, body.length);
  if (range === "unsatisfiable") {
    return reply.status(416).header("content-range", `bytes */${body.length}`).send();
  }
  if (range === null) {
    return reply.send(body);
  }
  return reply
    .status(206)
    .header("content-range", `bytes ${range.start}-${range.end}/${body.length}`)
    .send(body.subarray(range.start, range.end + 1));
};

// Why the audio file is public: docs/features/tts-pre-rendered-speech.md, "The API side".
export const audioRoutes = (app: FastifyInstance, audio: AudioServices | null, clock: () => Date): void => {
  const services = (): AudioServices => {
    if (audio === null) {
      throw new ApiError("unavailable", "Narration is not set up on this server");
    }
    return audio;
  };

  app.post("/audio", async (request, reply) => {
    const { renders, queue } = services();
    const { lines, voice, priority } = parseOrThrow(AudioRequest, request.body, "The audio request");
    const accountId = request.session!.accountId;
    const key = audioKey(lines, voice);

    const existing = await renders.get(key);
    request.log.info(
      apiLogLines.audio.requested({ key, priority, found: existing?.status ?? null, foundPriority: existing?.priority ?? null }),
    );
    if (existing?.status === "ready") {
      return describe(existing);
    }
    const alreadyWaiting = existing?.status === "queued" || existing?.status === "rendering";
    if (!alreadyWaiting && (await renders.outstandingFor(accountId, key)) >= MAX_OUTSTANDING_RENDERS_PER_ACCOUNT) {
      throw new ApiError("too_many_requests", "Too much narration is already being prepared for this account", {
        limit: MAX_OUTSTANDING_RENDERS_PER_ACCOUNT,
      });
    }
    if (!alreadyWaiting && !(await renders.takeDailyRender(clock(), accountId, MAX_NEW_RENDERS_PER_ACCOUNT_PER_DAY))) {
      const retryAfterSeconds = secondsToNextUsageDay(clock());
      request.log.warn(apiLogLines.audio.dailyCapSpent({ limit: MAX_NEW_RENDERS_PER_ACCOUNT_PER_DAY, retryAfterSeconds }));
      reply.header("retry-after", String(retryAfterSeconds));
      throw new ApiError("too_many_requests", "This account has started as much new narration as it can today", {
        quota: "narration-daily",
        limit: MAX_NEW_RENDERS_PER_ACCOUNT_PER_DAY,
        retryAfterSeconds,
      });
    }
    const render = await renders.enqueue({
      key,
      voice,
      renderVersion: TTS_RENDER_VERSION,
      lines,
      priority,
      requestedBy: accountId,
      now: clock(),
    });
    request.log.info(apiLogLines.audio.queued({ key, priority, voice, lines: lines.length, status: render.status }));
    queue.kick();
    return reply.status(202).send(describe(render));
  });

  // Finds narration given in another voice: docs/features/narration-voice.md, "Old audio".
  app.post("/audio/lookup", async (request) => {
    const { renders } = services();
    const { keys } = parseOrThrow(AudioLookup, request.body, "The audio lookup");
    return { renders: (await renders.getMany(keys)).map(describe) };
  });

  app.get("/audio/samples", { config: { public: true } }, async (_request, reply) => {
    const { samples } = services();
    reply.header("cache-control", "no-cache");
    return {
      samples: (await samples.ready()).map(({ key, voice, durationSeconds }) => ({
        voice,
        fileUrl: fileUrlOf(key),
        durationSeconds,
      })),
    };
  });

  app.delete("/audio/:key", async (request, reply) => {
    const { renders, store } = services();
    const { key } = parseOrThrow(KeyParams, request.params, AUDIO_KEY_LABEL);
    if (!(await renders.deleteRequestedBy(key, request.session!.accountId))) {
      throw new ApiError("not_found", "No narration this account asked for has this key");
    }
    await store.delete(key);
    await store.deleteSegments(key);
    request.log.info(apiLogLines.audio.deleted({ key }));
    return reply.status(204).send();
  });

  app.get("/audio/:key", async (request) => {
    const { renders } = services();
    const { key } = parseOrThrow(KeyParams, request.params, AUDIO_KEY_LABEL);
    const render = await renders.get(key);
    if (render === null) {
      throw new ApiError("not_found", "No narration has been asked for with this key");
    }
    return describe(render);
  });

  app.get("/audio/:key/playlist.m3u8", { config: { public: true } }, async (request, reply) => {
    const { renders } = services();
    const { key } = parseOrThrow(KeyParams, request.params, AUDIO_KEY_LABEL);
    const render = await renders.get(key);
    if (render === null || render.segmentSeconds === null || render.segmentSeconds.length === 0) {
      throw new ApiError("not_found", "No narration is being streamed with this key");
    }
    return reply.header(CONTENT_TYPE, "application/vnd.apple.mpegurl").header("cache-control", "no-store").send(playlistOf(render));
  });

  app.get("/audio/:key/segments/:segment", { config: { public: true } }, async (request, reply) => {
    const { store } = services();
    const { key, segment: index } = parseOrThrow(SegmentParams, request.params, "The segment");
    const segment = await store.getSegment(key, index);
    if (segment === null) {
      throw new ApiError("not_found", "No segment is stored with this key and number");
    }
    reply.header(CONTENT_TYPE, NARRATION_SEGMENT_TYPE).header("cache-control", "public, max-age=3600, immutable");
    return sendRanged(request.headers.range, segment, reply);
  });

  app.get("/audio/:key/file", { config: { public: true } }, async (request, reply) => {
    const { store } = services();
    const { key } = parseOrThrow(KeyParams, request.params, AUDIO_KEY_LABEL);
    const file = await store.get(key);
    if (file === null) {
      throw new ApiError("not_found", "No narration is stored with this key");
    }
    reply.header(CONTENT_TYPE, NARRATION_FILE_TYPE).header("cache-control", "public, max-age=31536000, immutable");
    return sendRanged(request.headers.range, file, reply);
  });
};
