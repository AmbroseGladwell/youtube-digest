// After the card said it could: another device spent the month's hours, or the feed's length changed.
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
