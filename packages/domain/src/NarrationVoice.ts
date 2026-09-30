import { z } from "zod";

export type NarrationAccent = "american" | "british";

// The English voices worth offering from Kokoro v1.0: graded C or better by Kokoro, and no
// novelty voices (docs/features/narration-voice.md, "The shortlist").
export const NARRATION_VOICES = {
  af_alloy: { name: "Alloy", accent: "american" },
  af_aoede: { name: "Aoede", accent: "american" },
  af_bella: { name: "Bella", accent: "american" },
  am_fenrir: { name: "Fenrir", accent: "american" },
  af_heart: { name: "Heart", accent: "american" },
  af_kore: { name: "Kore", accent: "american" },
  am_michael: { name: "Michael", accent: "american" },
  af_nicole: { name: "Nicole", accent: "american" },
  af_nova: { name: "Nova", accent: "american" },
  am_puck: { name: "Puck", accent: "american" },
  af_sarah: { name: "Sarah", accent: "american" },
  bf_emma: { name: "Emma", accent: "british" },
  bm_fable: { name: "Fable", accent: "british" },
  bm_george: { name: "George", accent: "british" },
  bf_isabella: { name: "Isabella", accent: "british" },
} as const satisfies Record<string, { name: string; accent: NarrationAccent }>;

type NarrationVoiceId = keyof typeof NARRATION_VOICES;

const NARRATION_VOICE_IDS = Object.keys(NARRATION_VOICES) as [NarrationVoiceId, ...NarrationVoiceId[]];

export const NarrationVoice = z.enum(NARRATION_VOICE_IDS);
export type NarrationVoice = z.infer<typeof NarrationVoice>;

export const DEFAULT_NARRATION_VOICE: NarrationVoice = "af_heart";

const LANGUAGE_BY_ACCENT: Record<NarrationAccent, string> = {
  american: "en-us",
  british: "en-gb",
};

export function narrationVoiceName(voice: NarrationVoice): string {
  return NARRATION_VOICES[voice].name;
}

export function narrationAccent(voice: NarrationVoice): NarrationAccent {
  return NARRATION_VOICES[voice].accent;
}

export function narrationLanguage(voice: NarrationVoice): string {
  return LANGUAGE_BY_ACCENT[narrationAccent(voice)];
}
