import { z } from "zod";

export type NarrationAccent = "american" | "british";

// Kokoro v1.0's English voices; the other 26 in voices-v1.0.bin speak other languages
// (docs/features/tts-pre-rendered-speech.md, "Voices").
export const NARRATION_VOICE_ACCENTS = {
  af_alloy: "american",
  af_aoede: "american",
  af_bella: "american",
  af_heart: "american",
  af_jessica: "american",
  af_kore: "american",
  af_nicole: "american",
  af_nova: "american",
  af_river: "american",
  af_sarah: "american",
  af_sky: "american",
  am_adam: "american",
  am_echo: "american",
  am_eric: "american",
  am_fenrir: "american",
  am_liam: "american",
  am_michael: "american",
  am_onyx: "american",
  am_puck: "american",
  am_santa: "american",
  bf_alice: "british",
  bf_emma: "british",
  bf_isabella: "british",
  bf_lily: "british",
  bm_daniel: "british",
  bm_fable: "british",
  bm_george: "british",
  bm_lewis: "british",
} as const satisfies Record<string, NarrationAccent>;

type NarrationVoiceId = keyof typeof NARRATION_VOICE_ACCENTS;

const NARRATION_VOICE_IDS = Object.keys(NARRATION_VOICE_ACCENTS) as [NarrationVoiceId, ...NarrationVoiceId[]];

export const NarrationVoice = z.enum(NARRATION_VOICE_IDS);
export type NarrationVoice = z.infer<typeof NarrationVoice>;

export const DEFAULT_NARRATION_VOICE: NarrationVoice = "af_heart";

const LANGUAGE_BY_ACCENT: Record<NarrationAccent, string> = {
  american: "en-us",
  british: "en-gb",
};

export function narrationLanguage(voice: NarrationVoice): string {
  return LANGUAGE_BY_ACCENT[NARRATION_VOICE_ACCENTS[voice]];
}
