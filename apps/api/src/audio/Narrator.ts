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

// The request id goes as X-Request-Id, so the service's lines carry the id the API logged the render under.
export interface Narrator {
  narrate(request: NarrationRequest, requestId: string): Promise<Narration>;
}
