import { NarrationVoice } from "@overview/domain";
import { TTS_RENDER_VERSION, audioKey } from "./audioKey.js";
import type { AudioRendersRepository } from "./AudioRendersRepository.js";
import type { AudioStore } from "./AudioStore.js";
import { VOICE_SAMPLE_LINES } from "./voiceSampleLines.js";
import type { VoiceSamplesRepository } from "./VoiceSamplesRepository.js";

export const SUPERSEDED_SAMPLE_KEPT_MS = 30 * 24 * 60 * 60 * 1000;

export interface SeedVoiceSamplesOptions {
  renders: AudioRendersRepository;
  samples: VoiceSamplesRepository;
  store: AudioStore;
  now: Date;
}

export interface SeededVoiceSamples {
  queued: NarrationVoice[];
  deleted: string[];
}

// One sample of the same passage per offered voice, through the same queue as a note
// (docs/features/narration-voice.md, "The samples").
export async function seedVoiceSamples({ renders, samples, store, now }: SeedVoiceSamplesOptions): Promise<SeededVoiceSamples> {
  const current = NarrationVoice.options.map((voice) => ({ voice, key: audioKey(VOICE_SAMPLE_LINES, voice) }));
  const queued: NarrationVoice[] = [];
  for (const { voice, key } of current) {
    if ((await renders.get(key))?.status === "ready") continue;
    await renders.enqueue({
      key,
      voice,
      renderVersion: TTS_RENDER_VERSION,
      lines: VOICE_SAMPLE_LINES,
      priority: "background",
      requestedBy: null,
      now,
    });
    queued.push(voice);
  }
  await samples.markCurrent(current, now);

  const deleted = await samples.supersededBefore(new Date(now.getTime() - SUPERSEDED_SAMPLE_KEPT_MS));
  for (const key of deleted) {
    await store.delete(key);
    await renders.delete(key);
  }
  return { queued, deleted };
}
