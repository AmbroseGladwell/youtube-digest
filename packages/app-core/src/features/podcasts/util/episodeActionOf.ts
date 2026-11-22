import type { TranscribeChoice, TranscriptionOffer } from "@overview/domain";
import type { EpisodeWords } from "../../newOverview/usePodcastLink.js";

type Offer<S extends TranscriptionOffer["status"]> = Extract<TranscriptionOffer, { status: S }>;

// What Create does for a found episode, from the check (designs 305c, 305d, 305h, 305j): it waits
// while the check runs; transcribes when the reader chooses it, or for free; stops in its place when
// it can't; and otherwise goes as it always has, asking after Create if it must (305c-2).
export type EpisodeAction =
  | { kind: "waiting" }
  | { kind: "create" }
  | { kind: "transcribe"; offer: Offer<"needed"> }
  | { kind: "free"; offer: Offer<"free"> }
  | { kind: "stop"; offer: Offer<"not-enough" | "too-long"> };

export const episodeActionOf = (words: EpisodeWords): EpisodeAction => {
  if (words.state === "checking") {
    return { kind: "waiting" };
  }
  if (words.state !== "none") {
    return { kind: "create" };
  }
  const offer = words.transcription;
  switch (offer.status) {
    case "needed":
      return { kind: "transcribe", offer };
    case "free":
      return { kind: "free", offer };
    case "not-enough":
    case "too-long":
      return { kind: "stop", offer };
    case "no-audio":
    case "unavailable":
      return { kind: "create" };
  }
};

// Whether Create sends the episode's audio to be transcribed rather than looking for its words, and
// why: the reader chose it on the card, or it costs nothing.
export const transcribeChoiceOf = (action: EpisodeAction | null): TranscribeChoice | undefined =>
  action?.kind === "transcribe" ? "chosen" : action?.kind === "free" ? "free" : undefined;

// The button's words: "Transcribe and create" only when it spends transcribing (design 305c).
export const createLabelOf = (action: EpisodeAction, otherwise: string): string =>
  action.kind === "transcribe" ? "Transcribe and create" : otherwise;
