import type { HostJobState, TranscribedAudio, Transcriber } from "./Transcriber.js";

export const transcribedAudio = (overrides: Partial<TranscribedAudio> = {}): TranscribedAudio => ({
  segments: [
    { text: "Welcome back to the show.", startMs: 0, endMs: 2400 },
    { text: "Today we talk about beginnings.", startMs: 2400, endMs: 5100 },
  ],
  audioSeconds: 1790.4,
  language: "en",
  gpu: "Tesla T4",
  cold: true,
  modelLoadSeconds: 3.1,
  workerSeconds: 30,
  ...overrides,
});

export interface ScriptedTranscriber extends Transcriber {
  submitted: { audioUrl: string; maxSeconds: number }[];
  cancelled: string[];
  // The last answer repeats once the script runs out.
  script: (HostJobState | Error)[];
}

export const makeScriptedTranscriber = (
  script: (HostJobState | Error)[] = [{ state: "running" }, { state: "done", result: transcribedAudio() }],
): ScriptedTranscriber => {
  const transcriber: ScriptedTranscriber = {
    submitted: [],
    cancelled: [],
    script,
    async submit(audioUrl, maxSeconds) {
      transcriber.submitted.push({ audioUrl, maxSeconds });
      return `fc-${transcriber.submitted.length}`;
    },
    async status() {
      const next = transcriber.script.length > 1 ? transcriber.script.shift()! : transcriber.script[0]!;
      if (next instanceof Error) {
        throw next;
      }
      return next;
    },
    async cancel(callId) {
      transcriber.cancelled.push(callId);
    },
  };
  return transcriber;
};
