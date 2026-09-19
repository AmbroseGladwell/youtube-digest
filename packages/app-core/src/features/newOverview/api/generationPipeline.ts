import {
  DEFAULT_SECTIONS_ENABLED,
  OverviewId,
  type Overview,
  type OverviewStore,
  type TranscriptStore,
  type VideoSource,
} from "@overview/types";
import { generateOverview, type GenerationClient } from "@overview/generation";
import type { TranscriptSourceClient } from "@overview/transcripts";
import { countWords } from "../../../util/countWords.js";
import { resolveVideo } from "../../transcripts/api/resolveVideo.js";
import { GenerationCancelledError } from "./GenerationCancelledError.js";

// What the run has produced so far, so the progress list can report a receipt rather than
// that it is thinking (docs/features/overview-redesign.md, "The receipts").
export interface GenerationProgress {
  video: VideoSource;
  transcriptWords: number;
}

export interface GenerationPipelineDeps {
  transcriptClient: TranscriptSourceClient;
  generationClient: GenerationClient;
  overviewStore: OverviewStore;
  transcriptStore: TranscriptStore;
}

export interface RunOverviewGenerationOptions {
  onProgress?: ((progress: GenerationProgress) => void) | undefined;
  isCancelled?: (() => boolean) | undefined;
}

export async function runOverviewGeneration(
  url: string,
  deps: GenerationPipelineDeps,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> {
  const stopIfCancelled = () => {
    if (options.isCancelled?.()) {
      throw new GenerationCancelledError();
    }
  };

  const { video, transcript } = await resolveVideo(url, deps);
  const transcriptWords = transcript.reduce((total, segment) => total + countWords(segment.text), 0);

  stopIfCancelled();
  options.onProgress?.({ video, transcriptWords });
  const [existingTopics, pastClaims] = await Promise.all([
    deps.overviewStore.listTopics(),
    deps.overviewStore.listClaims(),
  ]);
  const overview = await generateOverview(
    deps.generationClient,
    {
      video,
      transcript,
      savedNote: null,
      readerContext: null,
      sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
      existingTopics,
      pastClaims,
    },
    { id: OverviewId.parse(crypto.randomUUID()), savedAt: new Date().toISOString() },
  );

  stopIfCancelled();
  await deps.overviewStore.saveOverview(overview);

  return overview;
}
