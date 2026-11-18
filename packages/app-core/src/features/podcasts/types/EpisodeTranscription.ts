// An episode the reader chose to transcribe: waiting for a card, then under way since when (design 305e).
export type EpisodeTranscription = { state: "starting" } | { state: "transcribing"; since: number };
