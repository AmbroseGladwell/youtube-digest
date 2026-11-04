import {
  composeReaderContext,
  articleSourceId,
  heldOverviewOf,
  OverviewId,
  sourceKey,
  tagUsage,
  type ArticleRead,
  type CaptureTranscriptSource,
  type ExtractedArticle,
  type Overview,
  type OverviewStore,
  type PlaylistOrigin,
  type SettingsStore,
  type TranscriptStore,
  type VideoSource,
} from "@overview/domain";
import type { OverviewInput } from "@overview/generation";
import { countWords } from "../../../util/countWords.js";
import { captureReasonFromDraft } from "../../overviews/util/captureReasonFromDraft.js";
import { resolveVideo, type VideoResolutionDeps } from "../../transcripts/api/resolveVideo.js";
import type { TranscriptSource } from "../../transcripts/types/TranscriptSource.js";
import { ArticleAlreadyHeldError } from "./ArticleAlreadyHeldError.js";
import { ArticleReadError } from "./ArticleReadError.js";
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
  // Makes the overview on whichever key can, and says which (makeOverviewOnKeys).
  makeOverview: (input: OverviewInput, meta: { id: OverviewId; savedAt: string }) => Promise<Overview>;
  overviewStore: OverviewStore;
  settingsStore: Pick<SettingsStore, "get">;
  transcriptStore: TranscriptStore;
}

export interface RunOverviewGenerationOptions {
  onProgress?: ((progress: GenerationProgress) => void) | undefined;
  onArticleRead?: ((article: ExtractedArticle) => void) | undefined;
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
  // Onboarding fetches the transcript, or reads the article, at once but writes only once the reader has answered
  // or skipped About you, so the first overview is made from their answers. Topics and
  // Settings are read after it settles (docs/features/onboarding.md, "Writing waits").
  waitToWrite?: (() => Promise<void>) | undefined;
}

export async function runOverviewGeneration(
  url: string,
  deps: GenerationPipelineDeps,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> {
  const { video, transcript, source: transcriptSource } = await resolveVideo(url, deps);
  const transcriptWords = transcript.reduce((total, segment) => total + countWords(segment.text), 0);

  stopIfCancelled(options);
  options.onProgress?.({ video, transcriptWords, transcriptSource });
  await waitToWrite(options);
  return writeOverview({ video, transcript }, deps, options);
}

// An article has no transcript to keep, so what's read is used and let go
// (docs/features/article-panel.md). Nothing is reserved until it is read, so a page that
// can't be read costs the reader nothing.
export async function runArticleOverviewGeneration(
  read: () => Promise<ArticleRead>,
  deps: Pick<GenerationPipelineDeps, "makeOverview" | "overviewStore" | "settingsStore">,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> {
  const result = await read();
  if (result.status === "failed") throw new ArticleReadError(result);
  stopIfCancelled(options);
  options.onArticleRead?.(result.article);
  if (options.overviewId === undefined) {
    const key = sourceKey({ kind: "web", id: await articleSourceId(result.article.url) })!;
    const held = await heldOverviewOf(deps.overviewStore, key);
    if (held !== null) throw new ArticleAlreadyHeldError(held);
  }
  await waitToWrite(options);
  return writeOverview({ article: result.article }, deps, options);
}

function stopIfCancelled(options: RunOverviewGenerationOptions): void {
  if (options.isCancelled?.()) throw new GenerationCancelledError();
}

async function waitToWrite(options: RunOverviewGenerationOptions): Promise<void> {
  if (!options.waitToWrite) return;
  await options.waitToWrite();
  stopIfCancelled(options);
}

type WhatToWrite = Pick<Extract<OverviewInput, { video: unknown }>, "video" | "transcript"> | { article: ExtractedArticle };

async function writeOverview(
  what: WhatToWrite,
  deps: Pick<GenerationPipelineDeps, "makeOverview" | "overviewStore" | "settingsStore">,
  options: RunOverviewGenerationOptions,
): Promise<Overview> {
  const [existingTopics, pastClaims, library, settings] = await Promise.all([
    deps.overviewStore.listTopics(),
    deps.overviewStore.listClaims(),
    deps.overviewStore.listOverviews(),
    deps.settingsStore.get(),
  ]);
  const existingTags = tagUsage(library.map((overview) => overview.tags));
  const overview = await deps.makeOverview(
    {
      ...what,
      captureReason: null,
      readerContext: composeReaderContext(settings.aboutYou, settings.learned),
      sectionsEnabled: settings.sectionsEnabled,
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

  stopIfCancelled(options);
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
