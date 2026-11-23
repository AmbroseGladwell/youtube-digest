import type { PodcastEpisode, StoredTranscript } from "@overview/domain";
import type { PodcastApi } from "@overview/sync";
import { transcribeAudio, type TranscribeOptions } from "./transcribeAudio.js";

export const transcribeEpisode = (
  api: Pick<PodcastApi, "transcribe" | "transcription">,
  episode: PodcastEpisode,
  options: TranscribeOptions = {},
): Promise<{ transcript: StoredTranscript }> =>
  transcribeAudio(
    { source: "podcast", start: () => api.transcribe({ feedUrl: episode.feedUrl, guid: episode.guid }), poll: api.transcription },
    options,
  );
