import {
  DEFAULT_SECTIONS_ENABLED,
  OverviewId,
  tagUsage,
  type CaptureTranscriptSource,
  type Overview,
  type OverviewStore,
  type PlaylistOrigin,
  type SettingsStore,
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
  settingsStore: Pick<SettingsStore, "get">;
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
  // How many of the note's tags were already in the library, counted against the library
  // as the run saw it (docs/features/tag-reuse.md).
  onTagged?: ((tagging: { reused: number; added: number }) => void) | undefined;
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
  const [existingTopics, pastClaims, library, settings] = await Promise.all([
    deps.overviewStore.listTopics(),
    deps.overviewStore.listClaims(),
    deps.overviewStore.listOverviews(),
    deps.settingsStore.get(),
  ]);
  const existingTags = tagUsage(library.map((overview) => overview.tags));
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
      existingTags,
      tagAliases: settings.tagAliases,
    },
    {
      id: options.overviewId ?? OverviewId.parse(crypto.randomUUID()),
      savedAt: new Date().toISOString(),
    },
  );

  stopIfCancelled();
  const known = new Set(existingTags.map(({ tag }) => tag));
  const reused = overview.tags.filter((tag) => known.has(tag)).length;
  options.onTagged?.({ reused, added: overview.tags.length - reused });
  const saved = {
    ...overview,
    ...(options.captureReason ? { captureReason: captureReasonFromDraft(options.captureReason()) } : {}),
    ...(options.fromPlaylist ? { fromPlaylist: options.fromPlaylist } : {}),
  };
  await deps.overviewStore.saveOverview(saved);

  return saved;
}
