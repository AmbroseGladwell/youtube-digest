export interface NarrationRequest {
  lines: string[];
  voice: string;
  language: string;
  renderVersion: number;
}

export interface Narration {
  lineStartsSeconds: number[];
  durationSeconds: number;
  synthesisSeconds: number;
  audio: Buffer;
}

// The TTS service, seen from the API: one script in, one M4A and its line starts out
// (docs/features/tts-pre-rendered-speech.md, "The service"). The request id is sent as
// X-Request-Id, so the service's lines for a render carry the id the API logged it under.
export interface Narrator {
  narrate(request: NarrationRequest, requestId: string): Promise<Narration>;
}
