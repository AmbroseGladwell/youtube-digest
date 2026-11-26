import type { AudioStore } from "./AudioStore.js";
import type { LineNarrated, Narration, NarrationRequest, Narrator, SpeechHost } from "./Narrator.js";

export interface ScriptedNarrator extends Narrator {
  requests: NarrationRequest[];
  warms: number;
  failNext(message: string): void;
  failAfterLine(lineIndex: number, message: string): void;
  pauseAfterLine(lineIndex: number): { resume: () => void; reached: Promise<void> };
}

const segmentOf = (index: number, line: string) => ({ index, durationSeconds: 1, audio: Buffer.from(`segment ${index}: ${line}`) });

// Each line is one second long and arrives as one segment, then one trailing segment of silence.
export const makeScriptedNarrator = (host: SpeechHost = "fly"): ScriptedNarrator => {
  const failures: string[] = [];
  const requests: NarrationRequest[] = [];
  const lineFailures = new Map<number, string>();
  const pauses = new Map<number, { wait: Promise<void>; reached: () => void }>();
  const narrator: ScriptedNarrator = {
    requests,
    warms: 0,
    async warm() {
      narrator.warms += 1;
      return host;
    },
    failNext(message) {
      failures.push(message);
    },
    failAfterLine(lineIndex, message) {
      lineFailures.set(lineIndex, message);
    },
    pauseAfterLine(lineIndex) {
      let resume = () => {};
      let reached = () => {};
      const wait = new Promise<void>((resolve) => (resume = resolve));
      const arrived = new Promise<void>((resolve) => (reached = resolve));
      pauses.set(lineIndex, { wait, reached });
      return { resume, reached: arrived };
    },
    async narrate(request, _requestId, onLine): Promise<Narration> {
      requests.push(request);
      const failure = failures.shift();
      if (failure !== undefined) {
        throw new Error(failure);
      }
      for (const [index, line] of request.lines.entries()) {
        const narrated: LineNarrated = { lineIndex: index, startSeconds: index, segments: [segmentOf(index, line)] };
        await onLine(narrated);
        const lineFailure = lineFailures.get(index);
        if (lineFailure !== undefined) {
          lineFailures.delete(index);
          throw new Error(lineFailure);
        }
        const pause = pauses.get(index);
        if (pause !== undefined) {
          pauses.delete(index);
          pause.reached();
          await pause.wait;
        }
      }
      return {
        lineStartsSeconds: request.lines.map((_, index) => index),
        durationSeconds: request.lines.length,
        synthesisSeconds: 0.5,
        audio: Buffer.from(`narration of ${request.lines.join(" | ")} in ${request.voice}`),
        trailingSegments: [segmentOf(request.lines.length, "the gap after")],
        host,
        fellBack: false,
      };
    },
  };
  return narrator;
};

export interface MemoryAudioStore extends AudioStore {
  files: Map<string, Buffer>;
  segments: Map<string, Buffer>;
  failingDeletes: boolean;
}

export const makeMemoryAudioStore = (): MemoryAudioStore => {
  const files = new Map<string, Buffer>();
  const segments = new Map<string, Buffer>();
  const store: MemoryAudioStore = {
    files,
    segments,
    failingDeletes: false,
    async putSegment(key, index, audio) {
      segments.set(`${key}/${index}`, audio);
    },
    async getSegment(key, index) {
      return segments.get(`${key}/${index}`) ?? null;
    },
    async deleteSegments(key) {
      if (store.failingDeletes) {
        throw new Error("Simulated: R2 is unreachable");
      }
      for (const name of [...segments.keys()].filter((name) => name.startsWith(`${key}/`))) {
        segments.delete(name);
      }
    },
    async put(key, audio) {
      files.set(key, audio);
    },
    async get(key) {
      return files.get(key) ?? null;
    },
    async delete(key) {
      if (store.failingDeletes) {
        throw new Error("Simulated: R2 is unreachable");
      }
      files.delete(key);
    },
  };
  return store;
};
