import {
  type CaptureEntry,
  type TranscribeChoice,
  composeReaderContext,
  articleSourceId,
  heldOverviewOf,
  OverviewId,
  podcastSource,
  podcastSourceId,
  hasTooFewWords,
  isWrittenPost,
  socialSource,
  sourceKey,
  tagUsage,
  tiktokSource,
  type SocialPost,
  type StoredTranscript,
  type TikTokVideo,
  type ArticleRead,
  type CaptureTranscriptSource,
  type ClientTimingReport,
  type ExtractedArticle,
  type NoteKind,
  type Overview,
  type OverviewStore,
  type PodcastEpisode,
  type PlaylistOrigin,
  type ProjectId,
  type ProjectStore,
  type SettingsStore,
  type TranscriptStore,
  type VideoSource,
  type CaptureStore,
  type CaptureSurface,
  type SavedCapture,
  isWrittenSource,
} from "@overview/domain";
import {
  clipAsVideo,
  episodeAsVideo,
  kindSampleOfVideo,
  postAsArticle,
  type KindSample,
  postAsVideo,
  type GenerationInput,
  type SocialGenerationInput,
  type WrittenPostGenerationInput,
  type OverviewInput,
  type PodcastGenerationInput,
  type TikTokGenerationInput,
} from "@overview/generation";
import type { PodcastTranscript } from "../../podcasts/api/podcastTranscript.js";
import { countWords } from "../../../util/countWords.js";
import { captureReasonFromDraft } from "../../overviews/util/captureReasonFromDraft.js";
import { resolveVideo, type VideoResolutionDeps } from "../../transcripts/api/resolveVideo.js";
import type { TranscriptSource } from "../../transcripts/types/TranscriptSource.js";
import { ArticleAlreadyHeldError } from "./ArticleAlreadyHeldError.js";
import { ArticleReadError } from "./ArticleReadError.js";
import { CaptureStopwatch } from "./CaptureStopwatch.js";
import { GenerationCancelledError } from "./GenerationCancelledError.js";
import { SocialPostTooShortError } from "./SocialPostTooShortError.js";
import { SavedWithoutOverview } from "./SavedWithoutOverview.js";
import { SavedSourceNeedsReadingError } from "./SavedSourceNeedsReadingError.js";
import { savedCaptureOf } from "./savedCaptureOf.js";
import type { OverviewMeta } from "./makeOverviewOnKeys.js";
import type { TranscriptionProgress } from "../../podcasts/api/transcribeAudio.js";

// Receipts rather than "thinking": docs/features/overview-redesign.md, "The receipts".
export interface GenerationProgress {
  video: VideoSource;
  transcriptWords: number;
  transcriptSource: CaptureTranscriptSource;
  // What onboarding suggests topics from: docs/features/onboarding.md, "Suggested topics".
  transcriptOpening: string;
}

const TRANSCRIPT_OPENING_CHARACTERS = 3000;

export interface GenerationPipelineDeps {
  sources: TranscriptSource[];
  warn?: VideoResolutionDeps["warn"];
  // docs/architecture/errors-and-logs.md, "Client timings".
  timed?: ((timing: ClientTimingReport) => void) | undefined;
  now?: (() => number) | undefined;
  makeOverview: (input: OverviewInput, meta: OverviewMeta) => Promise<Overview>;
  overviewStore: OverviewStore;
  settingsStore: Pick<SettingsStore, "get">;
  transcriptStore: TranscriptStore;
  // Absent, nothing is filed into projects (docs/features/projects.md, "Filing as an overview is made").
  projectStore?: Pick<ProjectStore, "listProjects" | "fileIntoProject"> | undefined;
  // Only for a save without an overview: docs/features/kept-links.md, "Saving at the limit".
  captureStore?: Pick<CaptureStore, "saveCapture"> | undefined;
  // On the key the overview would be written with, and only when beforeWriting asks for it.
  checkKind?: ((sample: KindSample) => Promise<NoteKind>) | undefined;
}

// What is about to be written: docs/features/personalisation.md, "Asked once more".
export type AboutToWrite =
  | { kind: "article"; recipe: boolean }
  | { kind: "podcast" }
  | { kind: "video"; noteKind: () => Promise<NoteKind | null> };

export interface TaggingCounts {
  reused: number;
  added: number;
}

export interface RunOverviewGenerationOptions {
  from?: CaptureEntry | undefined;
  onProgress?: ((progress: GenerationProgress) => void) | undefined;
  onArticleRead?: ((article: ExtractedArticle) => void) | undefined;
  onEpisodeWords?: ((words: number) => void) | undefined;
  onTranscription?: ((progress: TranscriptionProgress) => void) | undefined;
  onWriting?: (() => void) | undefined;
  isCancelled?: (() => boolean) | undefined;
  // docs/features/record-migrations.md, "Salvage, so the reader has something to do".
  overviewId?: OverviewId | undefined;
  // Read as the record is written, not when the run starts: the reason is typed while the run goes.
  captureReason?: (() => string) | undefined;
  fromPlaylist?: PlaylistOrigin | undefined;
  onTagged?: ((tagging: TaggingCounts) => void) | undefined;
  onPersonalised?: ((personalised: boolean) => void) | undefined;
  // A video's kind, already checked before the account (OV-327), so writing skips its own check.
  noteKind?: NoteKind | undefined;
  // The same measurement the timing is sent from, so the event's duration agrees with it.
  onTimed?: ((timing: ClientTimingReport) => void) | undefined;
  onAttempt?: OverviewMeta["onAttempt"];
  // Not called when nothing was offered for filing: switched off, no projects, or a regeneration.
  onProjectsFiled?: ((count: number) => void) | undefined;
  // Set, the words are kept and the link saved, and no overview is written (docs/features/kept-links.md).
  saveInstead?: CaptureSurface | undefined;
  // Written under its saved capture's id, but filed as a new overview is.
  madeFromSaved?: boolean | undefined;
  // Resolves true once the reader was asked something, so the wait is timed apart from the run.
  beforeWriting?: ((about: AboutToWrite) => Promise<boolean>) | undefined;
}

export const runOverviewGeneration = async (
  url: string,
  deps: GenerationPipelineDeps,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> => {
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
    stopIfCancelled(options);
    const overview = await writeOverview(
      { video, transcript, ...(options.noteKind === undefined ? {} : { noteKind: options.noteKind }) },
      deps,
      options,
      stopwatch,
    );
    timed("finished");
    return overview;
  } catch (error) {
    timed(error instanceof GenerationCancelledError ? "cancelled" : "failed");
    throw error;
  }
};

// Nothing is reserved until the page is read, so a page that can't be read costs the reader nothing.
export const runArticleOverviewGeneration = async (
  read: () => Promise<ArticleRead>,
  deps: Pick<GenerationPipelineDeps, "makeOverview" | "overviewStore" | "settingsStore" | "projectStore" | "captureStore" | "checkKind">,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> => {
  const result = await read();
  if (result.status === "failed") {
    throw new ArticleReadError(result);
  }
  stopIfCancelled(options);
  options.onArticleRead?.(result.article);
  if (options.overviewId === undefined) {
    const key = sourceKey({ kind: "web", id: await articleSourceId(result.article.url) })!;
    const held = await heldOverviewOf(deps.overviewStore, key);
    if (held !== null) {
      throw new ArticleAlreadyHeldError(held);
    }
  }
  stopIfCancelled(options);
  return writeOverview({ article: result.article }, deps, options);
};

export interface PodcastRunRequest {
  episode: PodcastEpisode;
  sharedFrom: string;
  transcribe?: TranscribeChoice | undefined;
}

// No words found makes nothing and costs nothing: docs/features/podcast-screens.md, "Making one".
export const runPodcastOverviewGeneration = async (
  { episode, sharedFrom }: PodcastRunRequest,
  findWords: (episode: PodcastEpisode, options: RunOverviewGenerationOptions) => Promise<Pick<PodcastTranscript, "transcript">>,
  deps: Pick<
    GenerationPipelineDeps,
    "makeOverview" | "overviewStore" | "settingsStore" | "transcriptStore" | "projectStore" | "captureStore" | "checkKind"
  >,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> => {
  const id = await podcastSourceId(episode);
  const key = sourceKey({ kind: "podcast", id })!;
  if (options.overviewId === undefined) {
    const held = await heldOverviewOf(deps.overviewStore, key);
    if (held !== null) {
      throw new ArticleAlreadyHeldError(held);
    }
  }
  const { transcript } = await findWords(episode, options);
  stopIfCancelled(options);
  await deps.transcriptStore.saveTranscript({ ...transcript, videoId: key });
  options.onEpisodeWords?.(transcript.segments.reduce((total, segment) => total + countWords(segment.text), 0));
  stopIfCancelled(options);
  const podcast = podcastSource(episode, id, sharedFrom);
  return writeOverview({ podcast, video: episodeAsVideo(podcast, episode.notes), transcript: transcript.segments }, deps, options);
};

export interface TikTokRunRequest {
  video: TikTokVideo;
  // None when it has no captions: then it is transcribed, only if the reader chose to.
  words: TikTokWords | null;
  transcribe?: TranscribeChoice | undefined;
}

export interface TikTokWords {
  transcript: StoredTranscript;
  source: Extract<CaptureTranscriptSource, "tiktok-tab" | "tiktok-vendor" | "tiktok-transcribed">;
}

// The words come with the read, so a clip that can't be read costs nothing to write (docs/features/tiktok-links.md).
export const runTikTokOverviewGeneration = async (
  video: TikTokVideo,
  findWords: (video: TikTokVideo) => Promise<TikTokWords>,
  deps: Pick<
    GenerationPipelineDeps,
    "makeOverview" | "overviewStore" | "settingsStore" | "transcriptStore" | "projectStore" | "captureStore" | "checkKind"
  >,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> => {
  const tiktok = tiktokSource(video);
  const key = sourceKey(tiktok)!;
  if (options.overviewId === undefined) {
    const held = await heldOverviewOf(deps.overviewStore, key);
    if (held !== null) {
      throw new ArticleAlreadyHeldError(held);
    }
  }
  const { transcript, source: transcriptSource } = await findWords(video);
  stopIfCancelled(options);
  await deps.transcriptStore.saveTranscript({ ...transcript, videoId: key });
  const clip = clipAsVideo(tiktok, video.description);
  const transcriptWords = transcript.segments.reduce((total, segment) => total + countWords(segment.text), 0);
  const transcriptOpening = transcript.segments
    .map((segment) => segment.text)
    .join(" ")
    .slice(0, TRANSCRIPT_OPENING_CHARACTERS);
  options.onProgress?.({ video: clip, transcriptWords, transcriptSource, transcriptOpening });
  stopIfCancelled(options);
  return writeOverview(
    { tiktok, video: clip, transcript: transcript.segments, ...(options.noteKind === undefined ? {} : { noteKind: options.noteKind }) },
    deps,
    options,
  );
};

export interface SocialRunRequest {
  post: SocialPost;
  // None for a photo or text post, or a video without them: then it is transcribed, only if the reader chose to.
  words: SocialWords | null;
  transcribe?: TranscribeChoice | undefined;
}

export interface SocialWords {
  transcript: StoredTranscript;
  source: Extract<CaptureTranscriptSource, "social-vendor" | "social-transcribed">;
}

// A video from its words and whole description; a photo or text post from the description alone (social-posts.md).
export const runSocialOverviewGeneration = async (
  post: SocialPost,
  findWords: (post: SocialPost) => Promise<SocialWords>,
  deps: Pick<
    GenerationPipelineDeps,
    "makeOverview" | "overviewStore" | "settingsStore" | "transcriptStore" | "projectStore" | "captureStore" | "checkKind"
  >,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> => {
  const social = socialSource(post);
  const key = sourceKey(social)!;
  if (options.overviewId === undefined) {
    const held = await heldOverviewOf(deps.overviewStore, key);
    if (held !== null) {
      throw new ArticleAlreadyHeldError(held);
    }
  }
  if (isWrittenPost(social)) {
    const article = postAsArticle(social, post.description);
    if (article === null || hasTooFewWords(social)) {
      throw new SocialPostTooShortError(social.wordCount);
    }
    stopIfCancelled(options);
    return writeOverview({ social, article }, deps, options);
  }
  const { transcript, source: transcriptSource } = await findWords(post);
  stopIfCancelled(options);
  await deps.transcriptStore.saveTranscript({ ...transcript, videoId: key });
  const video = postAsVideo(social, post.description);
  const transcriptWords = transcript.segments.reduce((total, segment) => total + countWords(segment.text), 0);
  const transcriptOpening = transcript.segments
    .map((segment) => segment.text)
    .join(" ")
    .slice(0, TRANSCRIPT_OPENING_CHARACTERS);
  options.onProgress?.({ video, transcriptWords, transcriptSource, transcriptOpening });
  stopIfCancelled(options);
  return writeOverview(
    { social, video, transcript: transcript.segments, ...(options.noteKind === undefined ? {} : { noteKind: options.noteKind }) },
    deps,
    options,
  );
};

// Its overview from what was kept: docs/features/kept-links.md, "Opening one".
export const runSavedOverviewGeneration = async (
  capture: SavedCapture,
  deps: Pick<GenerationPipelineDeps, "makeOverview" | "overviewStore" | "settingsStore" | "transcriptStore" | "projectStore" | "checkKind">,
  options: RunOverviewGenerationOptions = {},
): Promise<Overview> => {
  const what = await savedWhatToWrite(capture, deps.transcriptStore);
  if ("video" in what && "transcript" in what) {
    const transcriptWords = what.transcript.reduce((total, segment) => total + countWords(segment.text), 0);
    const transcriptOpening = what.transcript
      .map((segment) => segment.text)
      .join(" ")
      .slice(0, TRANSCRIPT_OPENING_CHARACTERS);
    options.onProgress?.({ video: what.video, transcriptWords, transcriptSource: "stored", transcriptOpening });
  }
  stopIfCancelled(options);
  return writeOverview(what, deps, { ...options, overviewId: capture.id, madeFromSaved: true });
};

const savedWhatToWrite = async (capture: SavedCapture, transcripts: TranscriptStore): Promise<WhatToWrite> => {
  const { source } = capture;
  const notes = capture.notes ?? "";
  if (isWrittenSource(source)) {
    if (source.kind === "web") {
      throw new SavedSourceNeedsReadingError();
    }
    const article = postAsArticle(source, notes);
    if (article === null) {
      throw new SavedSourceNeedsReadingError();
    }
    return { social: source, article };
  }
  const stored = await transcripts.getTranscript(capture.sourceKey);
  if (stored === null) {
    throw new SavedSourceNeedsReadingError();
  }
  const transcript = stored.segments;
  switch (source.kind) {
    case "youtube":
      return { video: notes === "" ? source : { ...source, fullDescription: notes }, transcript };
    case "podcast":
      return { podcast: source, video: episodeAsVideo(source, notes), transcript };
    case "tiktok":
      return { tiktok: source, video: clipAsVideo(source, notes), transcript };
    default:
      return { social: source, video: postAsVideo(source, notes), transcript };
  }
};

const stopIfCancelled = (options: RunOverviewGenerationOptions): void => {
  if (options.isCancelled?.()) {
    throw new GenerationCancelledError();
  }
};

// What a regeneration keeps: docs/features/one-overview-per-video.md, "Regenerating".
const keptOnRegeneration = (previous: Overview) => ({
  savedAt: previous.savedAt,
  captureReason: previous.captureReason,
  topicIds: previous.topicIds,
  tags: previous.tags,
  fromPlaylist: previous.fromPlaylist,
  ...(previous.fromSample ? { fromSample: previous.fromSample } : {}),
});

type WhatToWrite =
  | Pick<GenerationInput, "video" | "transcript" | "noteKind">
  | Pick<PodcastGenerationInput, "podcast" | "video" | "transcript">
  | Pick<TikTokGenerationInput, "tiktok" | "video" | "transcript" | "noteKind">
  | Pick<SocialGenerationInput, "social" | "video" | "transcript" | "noteKind">
  | Pick<WrittenPostGenerationInput, "social" | "article">
  | { article: ExtractedArticle };

interface AskedBeforeWriting {
  what: WhatToWrite;
  asked: boolean;
}

const askBeforeWriting = async (
  what: WhatToWrite,
  beforeWriting: NonNullable<RunOverviewGenerationOptions["beforeWriting"]>,
  checkKind: GenerationPipelineDeps["checkKind"],
): Promise<AskedBeforeWriting> => {
  if ("article" in what) {
    return { what, asked: await beforeWriting({ kind: "article", recipe: what.article.recipe !== null }) };
  }
  if ("podcast" in what) {
    return { what, asked: await beforeWriting({ kind: "podcast" }) };
  }
  let checked: NoteKind | null | undefined = what.noteKind;
  const noteKind = async (): Promise<NoteKind | null> => {
    if (checked === undefined) {
      checked = checkKind === undefined ? null : await checkKind(kindSampleOfVideo(what)).catch(() => null);
    }
    return checked;
  };
  const asked = await beforeWriting({ kind: "video", noteKind });
  return { what: checked === undefined || checked === null ? what : { ...what, noteKind: checked }, asked };
};

const writeOverview = async (
  given: WhatToWrite,
  deps: Pick<GenerationPipelineDeps, "makeOverview" | "overviewStore" | "settingsStore" | "projectStore" | "captureStore" | "checkKind">,
  options: RunOverviewGenerationOptions,
  stopwatch: CaptureStopwatch | null = null,
): Promise<Overview> => {
  let what = given;
  if (options.saveInstead !== undefined && deps.captureStore !== undefined) {
    const capture = await savedCaptureOf(what, {
      id: options.overviewId,
      keptFrom: options.saveInstead,
      captureReason: options.captureReason ? captureReasonFromDraft(options.captureReason()) : null,
      now: new Date(),
    });
    await deps.captureStore.saveCapture(capture);
    throw new SavedWithoutOverview(capture);
  }
  if (options.beforeWriting !== undefined) {
    const waited = stopwatch?.begin("aboutYou");
    const answer = await askBeforeWriting(what, options.beforeWriting, deps.checkKind);
    what = answer.what;
    if (answer.asked) {
      waited?.("answered");
    }
    stopIfCancelled(options);
  }
  options.onWriting?.();
  const [existingTopics, claims, library, settings, previous, projects] = await Promise.all([
    deps.overviewStore.listTopics(),
    deps.overviewStore.listClaims(),
    deps.overviewStore.listOverviews(),
    deps.settingsStore.get(),
    // An unreadable record has nothing left to keep, and is regenerated whole.
    options.overviewId === undefined ? null : deps.overviewStore.getOverview(options.overviewId).catch(() => null),
    deps.projectStore?.listProjects() ?? [],
  ]);
  // A regeneration keeps where the reader filed it, so only a new overview is filed.
  const existingProjects =
    settings.fileIntoProjects && (options.overviewId === undefined || options.madeFromSaved === true)
      ? projects.filter((project) => project.archivedAt === null).map(({ id, name, purpose }) => ({ id, name, purpose }))
      : [];
  let filedProjectIds: ProjectId[] = [];
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
        existingProjects,
        pastClaims,
        existingTags,
        tagAliases: settings.tagAliases,
      },
      {
        id: options.overviewId ?? OverviewId.parse(crypto.randomUUID()),
        savedAt: new Date().toISOString(),
        onAttempt: options.onAttempt,
        onProjectsFiled: (ids) => {
          filedProjectIds = ids;
        },
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
  if (existingProjects.length > 0) {
    for (const projectId of filedProjectIds) {
      await deps.projectStore!.fileIntoProject(projectId, saved.id);
    }
    options.onProjectsFiled?.(filedProjectIds.length);
  }

  return saved;
};
