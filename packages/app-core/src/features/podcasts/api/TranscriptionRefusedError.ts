// A transcription our server wouldn't start, though the card said it could: the month's hours went
// on another device meanwhile, or the feed's length changed (designs 305h, 305j).
export class TranscriptionRefusedError extends Error {
  readonly refusal: "not-enough" | "too-long";
  readonly episodeSeconds: number | null;

  constructor(refusal: "not-enough" | "too-long", episodeSeconds: number | null) {
    super(refusal === "too-long" ? "The episode is too long to transcribe" : "There isn't enough transcribing left this month");
    this.name = "TranscriptionRefusedError";
    this.refusal = refusal;
    this.episodeSeconds = episodeSeconds;
  }
}
