import type { AudioStore } from "./AudioStore.js";
import type { Narration, NarrationRequest, Narrator } from "./Narrator.js";

export interface ScriptedNarrator extends Narrator {
  requests: NarrationRequest[];
  failNext(message: string): void;
}

// A TTS service that says each line in one second, and fails when told to.
export function makeScriptedNarrator(): ScriptedNarrator {
  const failures: string[] = [];
  const requests: NarrationRequest[] = [];
  return {
    requests,
    failNext(message) {
      failures.push(message);
    },
    async narrate(request): Promise<Narration> {
      requests.push(request);
      const failure = failures.shift();
      if (failure !== undefined) {
        throw new Error(failure);
      }
      return {
        lineStartsSeconds: request.lines.map((_, index) => index),
        durationSeconds: request.lines.length,
        synthesisSeconds: 0.5,
        audio: Buffer.from(`narration of ${request.lines.join(" | ")} in ${request.voice}`),
      };
    },
  };
}

export interface MemoryAudioStore extends AudioStore {
  files: Map<string, Buffer>;
  // The next deletes fail the way R2 would while it is unreachable.
  failingDeletes: boolean;
}

export function makeMemoryAudioStore(): MemoryAudioStore {
  const files = new Map<string, Buffer>();
  const store: MemoryAudioStore = {
    files,
    failingDeletes: false,
    async put(key, audio) {
      files.set(key, audio);
    },
    async get(key) {
      return files.get(key) ?? null;
    },
    async delete(key) {
      if (store.failingDeletes) throw new Error("Simulated: R2 is unreachable");
      files.delete(key);
    },
  };
  return store;
}
