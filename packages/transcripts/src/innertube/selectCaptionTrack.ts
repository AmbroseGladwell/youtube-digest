import type { CaptionTrack } from "./PlayerResponse.js";

export interface SelectCaptionTrackOptions {
  lang?: string | undefined;
  allowMachineTranscription: boolean;
}

const DEFAULT_LANG = "en";

const inLanguage = (tracks: CaptionTrack[], lang: string): CaptionTrack | undefined =>
  tracks.find((track) => track.languageCode === lang) ??
  tracks.find((track) => track.languageCode?.startsWith(`${lang}-`));

// A human-written track is preferred over a machine-heard one in any language, because
// what generated records is whether anyone wrote it (docs/features/transcript-retrieval.md).
// Translations are never chosen: a translation is not the video's own words.
export function selectCaptionTrack(
  tracks: readonly CaptionTrack[],
  options: SelectCaptionTrackOptions,
): CaptionTrack | null {
  const lang = options.lang ?? DEFAULT_LANG;
  const written = tracks.filter((track) => track.kind !== "asr");
  const machine = tracks.filter((track) => track.kind === "asr");

  const pick = (from: CaptionTrack[]): CaptionTrack | undefined =>
    inLanguage(from, lang) ?? (lang === DEFAULT_LANG ? from[0] : inLanguage(from, DEFAULT_LANG) ?? from[0]);

  return pick(written) ?? (options.allowMachineTranscription ? pick(machine) ?? null : null);
}

export const isMachineTranscribed = (track: CaptionTrack): boolean => track.kind === "asr";
