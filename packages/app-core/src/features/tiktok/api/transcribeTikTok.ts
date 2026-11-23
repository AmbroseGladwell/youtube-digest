import type { StoredTranscript, TikTokVideo } from "@overview/domain";
import type { TikTokApi } from "@overview/sync";
import { transcribeAudio, type TranscribeOptions } from "../../podcasts/api/transcribeAudio.js";

// Our server reads the TikTok afresh for its file: docs/features/tiktok-links.md, "Transcribing a TikTok with no captions".
export const transcribeTikTok = (
  api: Pick<TikTokApi, "transcribe" | "transcription">,
  video: Pick<TikTokVideo, "url">,
  options: TranscribeOptions = {},
): Promise<{ transcript: StoredTranscript }> =>
  transcribeAudio({ source: "tiktok", start: () => api.transcribe(video.url), poll: api.transcription }, options);
