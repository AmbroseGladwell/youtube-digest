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
}

// The request id goes as X-Request-Id, so the service's lines carry the id the API logged the render under.
export interface Narrator {
  narrate(request: NarrationRequest, requestId: string, onLine: (line: LineNarrated) => Promise<void>): Promise<Narration>;
  warm(requestId: string): Promise<void>;
}
