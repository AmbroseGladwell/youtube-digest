import {
  DEFAULT_SECTIONS_ENABLED,
  OverviewId,
  type CaptureTranscriptSource,
  type Overview,
  type OverviewStore,
  type PlaylistOrigin,
  type TranscriptStore,
  type VideoSource,
} from "@overview/domain";
import { generateOverview, type GenerationClient } from "@overview/generation";
import { countWords } from "../../../util/countWords.js";
import { captureReasonFromDraft } from "../../overviews/util/captureReasonFromDraft.js";
import { resolveVideo, type VideoResolutionDeps } from "../../transcripts/api/resolveVideo.js";
import type { TranscriptSource } from "../../transcripts/types/TranscriptSource.js";
import { GenerationCancelledError } from "./GenerationCancelledError.js";

// What the run has produced so far, so the progress list can report a receipt rather than
// that it is thinking (docs/features/overview-redesign.md, "The receipts").
export interface GenerationProgress {
  video: VideoSource;
  transcriptWords: number;
  transcriptSource: CaptureTranscriptSource;
}

export interface GenerationPipelineDeps {
  sources: TranscriptSource[];
  warn?: VideoResolutionDeps["warn"];
  generationClient: GenerationClient;
  overviewStore: OverviewStore;
  transcriptStore: TranscriptStore;
}

export interface RunOverviewGenerationOptions {
  onProgress?: ((progress: GenerationProgress) => void) | undefined;
  isCancelled?: (() => boolean) | undefined;
  // Regenerating an unreadable record writes under its own id, so the separate state row
  // — read, favourite, user tags — stays attached rather than being orphaned under a new
  // one (docs/features/record-migrations.md).
  overviewId?: OverviewId | undefined;
  // Read at the moment the record is written, not when the run starts: the reason is
  // typed while the overview is being made (docs/features/capture-reason.md).
  captureReason?: (() => string) | undefined;
  // Set for a video the capture queue took from a followed playlist
  // (docs/features/playlists.md, "The From line").
  fromPlaylist?: PlaylistOrigin | undefined;
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

  const { video, transcript, source: transcriptSource } = await resolveVideo(url, deps);
  const transcriptWords = transcript.reduce((total, segment) => total + countWords(segment.text), 0);

  stopIfCancelled();
  options.onProgress?.({ video, transcriptWords, transcriptSource });
  const [existingTopics, pastClaims] = await Promise.all([
    deps.overviewStore.listTopics(),
    deps.overviewStore.listClaims(),
  ]);
  const overview = await generateOverview(
    deps.generationClient,
    {
      video,
      transcript,
      captureReason: null,
      readerContext: null,
      sectionsEnabled: DEFAULT_SECTIONS_ENABLED,
      existingTopics,
      pastClaims,
    },
    {
      id: options.overviewId ?? OverviewId.parse(crypto.randomUUID()),
      savedAt: new Date().toISOString(),
    },
  );

  stopIfCancelled();
  const saved = {
    ...overview,
    ...(options.captureReason ? { captureReason: captureReasonFromDraft(options.captureReason()) } : {}),
    ...(options.fromPlaylist ? { fromPlaylist: options.fromPlaylist } : {}),
  };
  await deps.overviewStore.saveOverview(saved);

  return saved;
}
