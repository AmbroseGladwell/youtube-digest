import type { TranscribeChoice, TranscriptionOffer } from "@overview/domain";
import type { EpisodeWords } from "../../newOverview/usePodcastLink.js";

type Offer<S extends TranscriptionOffer["status"]> = Extract<TranscriptionOffer, { status: S }>;

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

export const transcribeChoiceOf = (action: EpisodeAction | null): TranscribeChoice | undefined => {
  if (action?.kind === "transcribe") {
    return "chosen";
  }
  if (action?.kind === "free") {
    return "free";
  }
  return undefined;
};

export const createLabelOf = (action: EpisodeAction, otherwise: string): string =>
  action.kind === "transcribe" ? "Transcribe and create" : otherwise;
