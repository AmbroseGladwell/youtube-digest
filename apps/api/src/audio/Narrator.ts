// Where a render ran: the Modal GPU first, the Fly pool as the fallback (OV-423).
export type SpeechHost = "modal" | "fly";

export interface NarrationRequest {
  lines: string[];
  voice: string;
  language: string;
  renderVersion: number;
}

export interface NarrationSegment {
  index: number;
  durationSeconds: number;
  audio: Buffer;
}

export interface LineNarrated {
  lineIndex: number;
  startSeconds: number;
  segments: NarrationSegment[];
}

export interface Narration {
  lineStartsSeconds: number[];
  durationSeconds: number;
  synthesisSeconds: number;
  audio: Buffer;
  trailingSegments: NarrationSegment[];
  host: SpeechHost;
  fellBack: boolean;
  // The card a Modal render ran on, as nvidia-smi names it; null on Fly.
  gpu: string | null;
}

// The request id goes as X-Request-Id, so the service's lines carry the id the API logged the render under.
export interface Narrator {
  narrate(
    request: NarrationRequest,
    requestId: string,
    onLine: (line: LineNarrated) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<Narration>;
  // Says which host it woke, so the right machine's time is charged.
  warm(requestId: string): Promise<SpeechHost>;
}
