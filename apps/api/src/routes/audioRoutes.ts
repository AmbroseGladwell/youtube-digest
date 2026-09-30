import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DEFAULT_NARRATION_VOICE, NarrationVoice, SpokenScript } from "@overview/domain";
import { AUDIO_KEY_PATTERN, TTS_RENDER_VERSION, audioKey } from "../audio/audioKey.js";
import type { AudioRender, AudioRendersRepository } from "../audio/AudioRendersRepository.js";
import type { AudioRenderQueue } from "../audio/AudioRenderQueue.js";
import type { AudioStore } from "../audio/AudioStore.js";
import type { VoiceSamplesRepository } from "../audio/VoiceSamplesRepository.js";
import { byteRange } from "../audio/byteRange.js";
import { ApiError } from "../http/ApiError.js";
import { parseOrThrow } from "../http/parseOrThrow.js";

export const MAX_OUTSTANDING_RENDERS_PER_ACCOUNT = 3;
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

const KeyParams = z.object({ key: z.string().regex(AUDIO_KEY_PATTERN) });

const AudioLookup = z.object({
  keys: z.array(z.string().regex(AUDIO_KEY_PATTERN)).min(1).max(MAX_KEYS_PER_LOOKUP),
});

const fileUrlOf = (key: string) => `/api/audio/${key}/file`;

const describe = (render: AudioRender) => ({
  key: render.key,
  status: render.status,
  ...(render.status === "ready"
    ? {
        lineStartsSeconds: render.lineStartsSeconds,
        durationSeconds: render.durationSeconds,
        fileUrl: fileUrlOf(render.key),
      }
    : {}),
});

// Narration by content: the key is a hash of what is said, in which voice, rendered how.
// The file itself is public, because an <audio> element sends no bearer and the key can
// only be computed by someone who already holds the words
// (docs/features/tts-pre-rendered-speech.md, "The API side").
export function audioRoutes(
  app: FastifyInstance,
  audio: AudioServices | null,
  clock: () => Date,
): void {
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
      { key, priority, found: existing?.status ?? null, foundPriority: existing?.priority ?? null },
      "audio requested",
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
    const render = await renders.enqueue({
      key,
      voice,
      renderVersion: TTS_RENDER_VERSION,
      lines,
      priority,
      requestedBy: accountId,
      now: clock(),
    });
    queue.kick();
    return reply.status(202).send(describe(render));
  });

  // Whichever of these keys exist, in any state: how a note finds narration it was given in
  // another voice (docs/features/narration-voice.md, "Old audio").
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
    const { key } = parseOrThrow(KeyParams, request.params, "The audio key");
    if (!(await renders.deleteRequestedBy(key, request.session!.accountId))) {
      throw new ApiError("not_found", "No narration this account asked for has this key");
    }
    await store.delete(key);
    request.log.info({ key }, "audio deleted");
    return reply.status(204).send();
  });

  app.get("/audio/:key", async (request) => {
    const { renders } = services();
    const { key } = parseOrThrow(KeyParams, request.params, "The audio key");
    const render = await renders.get(key);
    if (render === null) {
      throw new ApiError("not_found", "No narration has been asked for with this key");
    }
    return describe(render);
  });

  app.get("/audio/:key/file", { config: { public: true } }, async (request, reply) => {
    const { store } = services();
    const { key } = parseOrThrow(KeyParams, request.params, "The audio key");
    const file = await store.get(key);
    if (file === null) {
      throw new ApiError("not_found", "No narration is stored with this key");
    }
    reply
      .header("content-type", "audio/mp4")
      .header("accept-ranges", "bytes")
      .header("cache-control", "public, max-age=31536000, immutable");
    const range = byteRange(request.headers.range, file.length);
    if (range === "unsatisfiable") {
      return reply.status(416).header("content-range", `bytes */${file.length}`).send();
    }
    if (range === null) {
      return reply.send(file);
    }
    return reply
      .status(206)
      .header("content-range", `bytes ${range.start}-${range.end}/${file.length}`)
      .send(file.subarray(range.start, range.end + 1));
  });
}
