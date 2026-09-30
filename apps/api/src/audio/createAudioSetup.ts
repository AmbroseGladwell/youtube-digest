import type { AudioSetup } from "../buildApp.js";
import type { AudioConfig } from "../loadConfig.js";
import { createFileAudioStore } from "./fileAudioStore.js";
import { createHttpNarrator } from "./httpNarrator.js";
import { createR2AudioStore } from "./r2AudioStore.js";

export function createAudioSetup(audio: NonNullable<AudioConfig>, runWorkers: boolean): AudioSetup {
  return {
    narrator: createHttpNarrator(audio.ttsUrl),
    store: audio.store.kind === "r2" ? createR2AudioStore(audio.store) : createFileAudioStore(audio.store.dir),
    concurrency: audio.concurrency,
    runWorkers,
  };
}
