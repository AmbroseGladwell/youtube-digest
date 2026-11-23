import type { SocialPost, StoredTranscript } from "@overview/domain";
import type { SocialApi } from "@overview/sync";
import { transcribeAudio, type TranscribeOptions } from "../../podcasts/api/transcribeAudio.js";

// Our server reads the post afresh for its file: docs/features/social-posts.md, "Transcribing a video".
export const transcribeSocial = (
  api: Pick<SocialApi, "transcribe" | "transcription">,
  post: Pick<SocialPost, "url" | "platform">,
  options: TranscribeOptions = {},
): Promise<{ transcript: StoredTranscript }> =>
  transcribeAudio({ source: post.platform, start: () => api.transcribe(post.url), poll: api.transcription }, options);
