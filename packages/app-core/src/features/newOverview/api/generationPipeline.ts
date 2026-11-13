import {
  composeReaderContext,
  articleSourceId,
  heldOverviewOf,
  OverviewId,
  podcastSource,
  podcastSourceId,
  sourceKey,
  tagUsage,
  type ArticleRead,
  type CaptureTranscriptSource,
  type ClientTimingReport,
  type ExtractedArticle,
  type Overview,
  type OverviewStore,
  type PodcastEpisode,
  type PlaylistOrigin,
  type SettingsStore,
  type TranscriptStore,
  type VideoSource,
} from "@overview/domain";
import { episodeAsVideo, type OverviewInput, type PodcastGenerationInput } from "@overview/generation";
import type { PodcastTranscript } from "../../podcasts/api/podcastTranscript.js";
import { countWords } from "../../../util/countWords.js";
import { captureReasonFromDraft } from "../../overviews/util/captureReasonFromDraft.js";
import { resolveVideo, type VideoResolutionDeps } from "../../transcripts/api/resolveVideo.js";
import type { TranscriptSource } from "../../transcripts/types/TranscriptSource.js";
import { ArticleAlreadyHeldError } from "./ArticleAlreadyHeldError.js";
import { ArticleReadError } from "./ArticleReadError.js";
import { CaptureStopwatch } from "./CaptureStopwatch.js";
import { GenerationCancelledError } from "./GenerationCancelledError.js";
import type { OverviewMeta } from "./makeOverviewOnKeys.js";

// What the run has produced so far, so the progress list can report a receipt rather than
// that it is thinking (docs/features/overview-redesign.md, "The receipts").
export interface GenerationProgress {
  video: VideoSource;
  transcriptWords: number;
  transcriptSource: CaptureTranscriptSource;
  // What onboarding suggests topics from before writing (docs/features/onboarding.md).
  transcriptOpening: string;
}

const TRANSCRIPT_OPENING_CHARACTERS = 3000;

export interface GenerationPipelineDeps {
  sources: TranscriptSource[];
  warn?: VideoResolutionDeps["warn"];
  // Told how a video capture's time split, however it ended, so the server's logs say so
  // (docs/architecture/errors-and-logs.md, "Client timings").
  timed?: ((timing: ClientTimingReport) => void) | undefined;
  now?: (() => number) | undefined;
  // Makes the overview on whichever key can, and says which (makeOverviewOnKeys).
  makeOverview: (input: OverviewInput, meta: OverviewMeta) => Promise<Overview>;
  overviewStore: OverviewStore;
  settingsStore: Pick<SettingsStore, "get">;
  transcriptStore: TranscriptStore;
}

export interface RunOverviewGenerationOptions {
  onProgress?: ((progress: GenerationProgress) => void) | undefined;
  onArticleRead?: ((article: ExtractedArticle) => void) | undefined;
  // An episode's words were found, so the steps can say so (design 106g).
  onEpisodeWords?: ((words: number) => void) | undefined;
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
  // Whether anything about the reader went into the prompt, as composed for this run
  // (docs/features/personalisation.md, "Analytics").
  onPersonalised?: ((personalised: boolean) => void) | undefined;
  // Onboarding fetches the transcript, or reads the article, at once but writes only once the reader has answered
  // or skipped About you, so the first overview is made from their answers. Topics and
  // Settings are read after it settles (docs/features/onboarding.md, "Writing waits").
  waitToWrite?: (() => Promise<void>) | undefined;
  // The same measurement the timing is sent from, so the event's duration agrees with it.
  onTimed?: ((timing: ClientTimingReport) => void) | undefined;
  // Each key as it is tried, so analytics names the one that made or failed the overview.
  onAttempt?: OverviewMeta["onAttempt"];
}

export async function runOverviewGeneration(
  url: string,
  deps: GenerationPipelineDeps,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> {
  const stopwatch = new CaptureStopwatch(deps.now);
  let transcriptCharacters = 0;
  const timed = (outcome: Parameters<CaptureStopwatch["report"]>[0]) => {
    const timing = stopwatch.report(outcome, transcriptCharacters);
    deps.timed?.(timing);
    options.onTimed?.(timing);
  };

  try {
    const { video, transcript, source: transcriptSource } = await resolveVideo(url, { ...deps, stopwatch });
    const transcriptWords = transcript.reduce((total, segment) => total + countWords(segment.text), 0);
    transcriptCharacters = transcript.reduce((total, segment) => total + segment.text.length, 0);

    stopIfCancelled(options);
    const transcriptOpening = transcript
      .map((segment) => segment.text)
      .join(" ")
      .slice(0, TRANSCRIPT_OPENING_CHARACTERS);
    options.onProgress?.({ video, transcriptWords, transcriptSource, transcriptOpening });
    await waitToWrite(options);
    const overview = await writeOverview({ video, transcript }, deps, options, stopwatch);
    timed("finished");
    return overview;
  } catch (error) {
    timed(error instanceof GenerationCancelledError ? "cancelled" : "failed");
    throw error;
  }
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

export interface PodcastRunRequest {
  episode: PodcastEpisode;
  // The link the reader pasted, kept as the overview's way out.
  sharedFrom: string;
}

// An episode is read before Create is pressed, so the run starts at its words: the free routes,
// then the note in a podcast's words. An episode with no words found makes nothing and costs
// nothing (docs/features/podcast-screens.md).
export async function runPodcastOverviewGeneration(
  { episode, sharedFrom }: PodcastRunRequest,
  findWords: (episode: PodcastEpisode) => Promise<PodcastTranscript>,
  deps: Pick<GenerationPipelineDeps, "makeOverview" | "overviewStore" | "settingsStore" | "transcriptStore">,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> {
  const id = await podcastSourceId(episode);
  const key = sourceKey({ kind: "podcast", id })!;
  if (options.overviewId === undefined) {
    const held = await heldOverviewOf(deps.overviewStore, key);
    if (held !== null) throw new ArticleAlreadyHeldError(held);
  }
  const { transcript } = await findWords(episode);
  stopIfCancelled(options);
  await deps.transcriptStore.saveTranscript({ ...transcript, videoId: key });
  options.onEpisodeWords?.(transcript.segments.reduce((total, segment) => total + countWords(segment.text), 0));
  await waitToWrite(options);
  const podcast = podcastSource(episode, id, sharedFrom);
  return writeOverview({ podcast, video: episodeAsVideo(podcast, episode.notes), transcript: transcript.segments }, deps, options);
}

function stopIfCancelled(options: RunOverviewGenerationOptions): void {
  if (options.isCancelled?.()) throw new GenerationCancelledError();
}

async function waitToWrite(options: RunOverviewGenerationOptions): Promise<void> {
  if (!options.waitToWrite) return;
  await options.waitToWrite();
  stopIfCancelled(options);
}

// A regeneration rewrites what the model wrote and keeps what the reader did: why they saved it,
// where they filed it, its tags, when they saved it and where it came from
// (docs/features/one-overview-per-video.md, "Regenerating").
const keptOnRegeneration = (previous: Overview) => ({
  savedAt: previous.savedAt,
  captureReason: previous.captureReason,
  topicIds: previous.topicIds,
  tags: previous.tags,
  fromPlaylist: previous.fromPlaylist,
  ...(previous.fromSample ? { fromSample: previous.fromSample } : {}),
});

type WhatToWrite =
  | Pick<Extract<OverviewInput, { video: unknown }>, "video" | "transcript">
  | Pick<PodcastGenerationInput, "podcast" | "video" | "transcript">
  | { article: ExtractedArticle };

async function writeOverview(
  what: WhatToWrite,
  deps: Pick<GenerationPipelineDeps, "makeOverview" | "overviewStore" | "settingsStore">,
  options: RunOverviewGenerationOptions,
  stopwatch: CaptureStopwatch | null = null,
): Promise<Overview> {
  const [existingTopics, claims, library, settings, previous] = await Promise.all([
    deps.overviewStore.listTopics(),
    deps.overviewStore.listClaims(),
    deps.overviewStore.listOverviews(),
    deps.settingsStore.get(),
    // An unreadable record has nothing left to keep, and is regenerated whole.
    options.overviewId === undefined ? null : deps.overviewStore.getOverview(options.overviewId).catch(() => null),
  ]);
  const pastClaims = claims.filter((claim) => claim.overviewId !== options.overviewId);
  const existingTags = tagUsage(library.map((overview) => overview.tags));
  const readerContext = composeReaderContext(settings.aboutYou, settings.learned);
  const make = () =>
    deps.makeOverview(
      {
        ...what,
        captureReason: null,
        readerContext,
        sectionsEnabled: settings.sectionsEnabled,
        existingTopics,
        pastClaims,
        existingTags,
        tagAliases: settings.tagAliases,
      },
      {
        id: options.overviewId ?? OverviewId.parse(crypto.randomUUID()),
        savedAt: new Date().toISOString(),
        onAttempt: options.onAttempt,
      },
    );
  const overview = await (stopwatch ? stopwatch.time("model", make) : make());

  stopIfCancelled(options);
  const known = new Set(existingTags.map(({ tag }) => tag));
  const reused = overview.tags.filter((tag) => known.has(tag)).length;
  options.onTagged?.({ reused, added: overview.tags.length - reused });
  options.onPersonalised?.(readerContext !== null);
  const saved = {
    ...overview,
    ...(previous === null ? {} : keptOnRegeneration(previous)),
    ...(options.captureReason ? { captureReason: captureReasonFromDraft(options.captureReason()) } : {}),
    ...(options.fromPlaylist ? { fromPlaylist: options.fromPlaylist } : {}),
  };
  const save = () => deps.overviewStore.saveOverview(saved);
  await (stopwatch ? stopwatch.time("save", save) : save());

  return saved;
}
