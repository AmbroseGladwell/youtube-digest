import {
  type TranscribeChoice,
  articleReadMinutes,
  articleSourceId,
  podcastSource,
  podcastSourceId,
  domainOf,
  formatClock,
  parsePodcastLink,
  parseTikTokLink,
  tiktokSource,
  type TikTokVideo,
  recipeMinutes,
  sourceName,
  webSource,
  youTubeSource,
  type ArticleRead,
  type PodcastEpisode,
  type PodcastRead,
  type TranscriptCheck,
  type StoredTranscript,
  type VideoRead,
  type ExtractedArticle,
  type Overview,
  type Recipe,
  type NoteKind,
  type Source,
  type SourceKey,
} from "@overview/domain";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import type { PodcastRunRequest, RunOverviewGenerationOptions, TikTokWords } from "../newOverview/api/generationPipeline.js";
import { TikTokNoCaptionsError, TikTokReadError } from "../newOverview/api/TikTokReadError.js";
import type { TikTokLinkRead } from "../tiktok/api/readTikTokLink.js";
import { GenerationCancelledError } from "../newOverview/api/GenerationCancelledError.js";
import { PodcastNoTranscriptError, PodcastReadError } from "../newOverview/api/PodcastReadError.js";
import { VideoReadError } from "../newOverview/api/VideoReadError.js";
import { EpisodeNeedsTranscribingError } from "../podcasts/api/EpisodeNeedsTranscribingError.js";
import type { TranscriptionProgress } from "../podcasts/api/transcribeEpisode.js";
import { isPlatformPodcastLink } from "../newOverview/usePodcastLink.js";
import { isArticleLink } from "../newOverview/useArticleLink.js";
import { extractYouTubeVideoId, youTubeLink } from "../newOverview/util/parseYouTubeUrl.js";
import { formatPublishedDate } from "../../util/formatPublishedDate.js";
import type { ExpectedMinutes } from "./util/expectedOverviewMinutes.js";
import { episodeWordsNotice } from "./util/episodeWordsNotice.js";
import { EpisodeCannotBeMadeError } from "./EpisodeCannotBeMadeError.js";

export type OnboardingLinkKind = "video" | "playlist" | "article" | "episode";

export type RecipeTimes = Pick<Recipe, "prepMinutes" | "cookMinutes" | "totalMinutes" | "yield">;

export interface OnboardingFound {
  source: Source;
  recipe: RecipeTimes | null;
  // Topics are suggested from this besides the title: a video's description, a page's opening.
  about: string;
  // A video already checked as a recipe before there is an account (327u-2).
  noteKind?: NoteKind | null;
  // So Your link can say the episode will be transcribed, or that it can't be (327v–327w-4).
  episodeWords?: TranscriptCheck | null;
}

export interface OnboardingMakers {
  video: (url: string, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readVideo: (videoId: string) => Promise<VideoRead>;
  // Kept in the library written into, so writing finds the transcript rather than fetching it again.
  keepTranscript: (transcript: StoredTranscript) => Promise<void>;
  article: (read: () => Promise<ArticleRead>, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readArticle: (url: string) => Promise<ArticleRead>;
  podcast: (request: PodcastRunRequest, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readTikTok: (url: string) => Promise<TikTokLinkRead>;
  tiktok: (video: TikTokVideo, words: TikTokWords, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readPodcast: (url: string) => Promise<PodcastRead>;
  // Free, and fetches no words (design 305c).
  checkEpisode: (episode: PodcastEpisode) => Promise<TranscriptCheck>;
}

export interface OnboardingMakeOptions {
  transcribe?: TranscribeChoice | undefined;
  onFound: (found: OnboardingFound) => void;
  onTranscription?: ((progress: TranscriptionProgress) => void) | undefined;
  isCancelled: () => boolean;
  onSourceWords?: ((words: number) => void) | undefined;
  onWriting?: (() => void) | undefined;
  // docs/features/onboarding.md, "Nothing paid before the account".
  waitToSpend: () => Promise<void>;
}

// A kind with no kicker keeps its facts as a byline under the title (154d–154g).
export interface OnboardingCard {
  kicker: string | null;
  facts: { line: string };
}

export interface TargetProgress {
  link: string;
  sourceKey: string | null;
}

export interface OnboardingSource {
  linkKind: (link: string) => OnboardingLinkKind | null;
  keyFromLink: (link: string) => SourceKey | null;
  // The link, or a playlist's chosen video; null until it's known.
  target: (progress: TargetProgress) => string | null;
  make: (target: string, makers: OnboardingMakers, options: OnboardingMakeOptions) => Promise<Overview>;
  noun: (linkKind: OnboardingLinkKind, found: OnboardingFound | null) => string;
  // The address, or null to show `finding`.
  pending: (link: string) => string | null;
  finding: string;
  notFound: string;
  card: (found: OnboardingFound) => OnboardingCard;
  yourLink: (found: OnboardingFound, minutes: ExpectedMinutes | null) => OnboardingYourLink;
}

export interface OnboardingYourLink {
  heading: string;
  line: string;
  pills: "readListen" | "cook";
  inside: string;
  // What Looks right agrees to (327w).
  notice?: string | null;
  // Shown in place of the pills and Looks right (327w-3, 327w-4).
  stop?: string | null;
}

const PAGE_OPENING_CHARACTERS = 3000;
const TRANSCRIPT_OPENING_CHARACTERS = 3000;

const pageOpening = (article: ExtractedArticle): string =>
  article.sections
    .map(({ heading, text }) => (heading === null ? text : `${heading} ${text}`))
    .join(" ")
    .slice(0, PAGE_OPENING_CHARACTERS);

const watchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

const INSIDE = "Premise, key points, a verdict, steps and more.";
const RECIPE_INSIDE = "Ingredients, the method step by step, timers, and amounts that scale to your servings.";
const RECIPE_LINE = "with just the ingredients and the method, easy to follow with cooking mode, and shareable.";

const turnedInto = (minutes: ExpectedMinutes | null): string =>
  minutes === null
    ? "turned into an overview you can read, listen to and share."
    : `turned into an overview you can read in about ${minutes.read}, listen to in about ${minutes.listen}, and share.`;

const spokenLength = (durationMs: number | null): string | null => {
  if (durationMs === null) {
    return null;
  }
  const minutes = Math.round(durationMs / 60_000);
  return minutes < 60 ? `${minutes} minutes` : recipeMinutes(minutes);
};

const platformOf = (link: string): string | null => {
  const platform = parsePodcastLink(link)?.platform;
  if (platform === "apple" || platform === "apple-show") {
    return "from Apple Podcasts";
  }
  return platform === "spotify" || platform === "spotify-short" || platform === "spotify-show" ? "from Spotify" : null;
};

const fromWhom = (length: string | null, who: string): string => (length === null ? `From ${who}` : `${length} from ${who}`);

const videoFacts = (source: Source): string =>
  [source.kind === "youtube" && source.durationMs !== null ? formatClock(source.durationMs / 1000) : null, "YouTube"]
    .filter(Boolean)
    .join(" · ");

const episodeLength = (source: Source): string | null =>
  source.kind === "podcast" && source.durationMs !== null ? recipeMinutes(Math.round(source.durationMs / 60_000)) : null;

// "1 hr 12 min · 10 Nov 2026 · from Spotify", leaving out what the feed doesn't give (106b, 327v).
const episodeFacts = (source: Source): string =>
  [
    episodeLength(source),
    source.publishedAt === null ? null : formatPublishedDate(source.publishedAt),
    source.kind === "podcast" ? platformOf(source.sharedFrom) : null,
  ]
    .filter(Boolean)
    .join(" · ");

const readMinutes = (source: Source): string | null => (source.kind === "web" ? `${articleReadMinutes(source.wordCount)} min read` : null);

export const TIKTOK_AT_START = true;

const clipLength = (source: Source): string | null =>
  source.kind === "tiktok" && source.durationMs !== null ? formatClock(source.durationMs / 1000) : null;

// "42 seconds from …": a clip is said in seconds, where spokenLength would round it to a minute or none.
const spokenClipLength = (source: Source): string | null => {
  if (source.kind !== "tiktok" || source.durationMs === null) {
    return null;
  }
  const seconds = Math.round(source.durationMs / 1000);
  return seconds < 60 ? `${seconds} seconds` : spokenLength(source.durationMs);
};

// Web stays last: it takes any address no other kind claims.
export const onboardingSources: { readonly [Kind in Source["kind"]]: OnboardingSource } = {
  youtube: {
    linkKind: (link) => {
      const parsed = youTubeLink(link);
      if (parsed === null) {
        return null;
      }
      if (parsed.kind === "playlist") {
        return "playlist";
      }
      return parsed.kind === "unfollowable" && parsed.videoUrl === null ? null : "video";
    },
    keyFromLink: (link) => {
      const parsed = youTubeLink(link);
      const videoUrl = parsed === null || parsed.kind === "playlist" ? null : parsed.videoUrl;
      return videoUrl === null ? null : (extractYouTubeVideoId(videoUrl) as SourceKey | null);
    },
    target: ({ sourceKey }) => (sourceKey === null ? null : watchUrl(sourceKey)),
    make: async (target, makers, { onFound, isCancelled, waitToSpend, onSourceWords, onWriting }) => {
      const read = await makers.readVideo(extractYouTubeVideoId(target) ?? target);
      if (read.status === "failed") {
        throw new VideoReadError(read.reason);
      }
      const opening = (read.transcript?.segments ?? [])
        .map((segment) => segment.text)
        .join(" ")
        .slice(0, TRANSCRIPT_OPENING_CHARACTERS);
      onFound({
        source: youTubeSource(read.video),
        recipe: null,
        about: [read.video.description ?? "", opening].filter((part) => part !== "").join("\n\n"),
        noteKind: read.noteKind,
      });
      await waitToSpend();
      if (isCancelled()) {
        throw new GenerationCancelledError();
      }
      if (read.transcript !== null) {
        await makers.keepTranscript({ ...read.transcript, video: read.video });
      }
      return makers.video(target, {
        isCancelled,
        onProgress: ({ transcriptWords }) => onSourceWords?.(transcriptWords),
        onWriting,
        ...(read.noteKind === null ? {} : { noteKind: read.noteKind }),
      });
    },
    noun: (linkKind, found) => {
      if (linkKind === "playlist") {
        return "playlist";
      }
      return found?.noteKind === "recipe" ? "recipe" : "video";
    },
    pending: () => null,
    finding: "Finding the video…",
    notFound: "We couldn't find that video.",
    card: ({ source, noteKind }) => ({
      kicker: `${sourceName(source)} · ${noteKind === "recipe" ? "Recipe video" : "Video"}`,
      facts: { line: videoFacts(source) },
    }),
    yourLink: ({ source, noteKind }, minutes) => {
      const length = spokenLength(source.kind === "youtube" ? source.durationMs : null);
      return noteKind === "recipe"
        ? {
            heading: "Here’s the recipe you saved.",
            line: `${sourceName(source)}’s ${length === null ? "" : `${length.replace(" minutes", "-minute")} `}video, ${RECIPE_LINE}`,
            pills: "cook",
            inside: "Ingredients, the method step by step with the moment in the video, timers, and amounts that scale.",
          }
        : {
            heading: "Here’s what’s in the video you saved.",
            line: `${fromWhom(length, sourceName(source))}, ${turnedInto(minutes)}`,
            pills: "readListen",
            inside: INSIDE,
          };
    },
  },
  // Checking and transcribing an episode's words: docs/features/onboarding.md, "Any kind of link".
  podcast: {
    linkKind: (link) => (isPlatformPodcastLink(link) ? "episode" : null),
    keyFromLink: () => null,
    target: ({ link }) => link,
    make: async (target, makers, { onFound, onTranscription, isCancelled, waitToSpend, transcribe, onSourceWords, onWriting }) => {
      const read = await makers.readPodcast(target);
      if (read.status === "failed") {
        throw new PodcastReadError(read.reason, read.showName ?? null);
      }
      const id = await podcastSourceId(read.episode);
      const episodeWords = await makers.checkEpisode(read.episode).catch((): TranscriptCheck => ({ words: "unknown" }));
      const source = podcastSource(read.episode, id, target);
      onFound({ source, recipe: null, about: read.episode.notes, episodeWords });
      if (episodeWordsNotice(episodeWords, source.kind === "podcast" ? source.durationMs : null).stop !== null) {
        throw new EpisodeCannotBeMadeError();
      }
      await waitToSpend();
      if (isCancelled()) {
        throw new GenerationCancelledError();
      }
      const make = (choice: TranscribeChoice | undefined) =>
        makers.podcast(
          { episode: read.episode, sharedFrom: target, transcribe: choice },
          {
            from: "onboarding",
            isCancelled,
            onTranscription,
            onEpisodeWords: (words) => onSourceWords?.(words),
            onWriting,
          },
        );
      const needsTranscribing = episodeWords.words === "none" && episodeWords.transcription.status !== "free";
      return (transcribe !== undefined || needsTranscribing ? make(transcribe ?? "chosen") : make(undefined))
        .catch((error: unknown) => {
          if (error instanceof EpisodeNeedsTranscribingError) {
            return make("chosen");
          }
          throw error;
        })
        .catch((error: unknown) => {
          if (error instanceof TranscriptFetchError && error.failure === TranscriptFetchFailure.NO_CAPTIONS) {
            throw new PodcastNoTranscriptError(error instanceof EpisodeNeedsTranscribingError, read.episode.durationSeconds);
          }
          throw error;
        });
    },
    noun: (_linkKind, found) => (found === null ? "page" : "episode"),
    pending: (link) => domainOf(link),
    finding: "Finding the episode…",
    notFound: "We couldn't find that episode.",
    card: ({ source }) => ({
      kicker: `${sourceName(source)} · Podcast`,
      facts: { line: episodeFacts(source) },
    }),
    yourLink: ({ source, episodeWords }, minutes) => {
      const { notice, stop } = episodeWordsNotice(episodeWords, source.kind === "podcast" ? source.durationMs : null);
      return stop !== null
        ? {
            heading: "We found the episode, but can’t make this one.",
            line: "Nothing has been used. Paste another link and we’ll start again.",
            pills: "readListen",
            inside: INSIDE,
            stop,
          }
        : {
            heading: "Here’s what’s in the episode you saved.",
            line: `${fromWhom(episodeLength(source), sourceName(source))}, ${turnedInto(minutes)}`,
            pills: "readListen",
            inside: INSIDE,
            notice,
          };
    },
  },
  // docs/features/tiktok-links.md, "Onboarding".
  tiktok: {
    linkKind: (link) =>
      TIKTOK_AT_START && parseTikTokLink(link)?.kind !== undefined && parseTikTokLink(link)?.kind !== "not-a-video" ? "video" : null,
    keyFromLink: () => null,
    target: ({ link }) => link,
    make: async (target, makers, { onFound, isCancelled, waitToSpend, onSourceWords, onWriting }) => {
      const read = await makers.readTikTok(target);
      if (read.status === "failed") {
        throw new TikTokReadError(read.reason);
      }
      if (read.words === null) {
        throw new TikTokNoCaptionsError();
      }
      const opening = read.words.transcript.segments
        .map((segment) => segment.text)
        .join(" ")
        .slice(0, TRANSCRIPT_OPENING_CHARACTERS);
      onFound({
        source: tiktokSource(read.video),
        recipe: null,
        about: [read.video.description.trim(), opening].filter((part) => part !== "").join("\n\n"),
      });
      await waitToSpend();
      if (isCancelled()) {
        throw new GenerationCancelledError();
      }
      return makers.tiktok(read.video, read.words, {
        isCancelled,
        onProgress: ({ transcriptWords }) => onSourceWords?.(transcriptWords),
        onWriting,
      });
    },
    noun: () => "video",
    pending: () => null,
    finding: "Finding the TikTok…",
    notFound: "We couldn't find that TikTok.",
    card: ({ source }) => ({
      kicker: `${sourceName(source)} · TikTok`,
      facts: { line: [clipLength(source), "TikTok"].filter(Boolean).join(" · ") },
    }),
    yourLink: ({ source }, minutes) => ({
      heading: "Here’s what’s in the TikTok you saved.",
      line: `${fromWhom(spokenClipLength(source), sourceName(source))}, ${turnedInto(minutes)}`,
      pills: "readListen",
      inside: INSIDE,
    }),
  },
  web: {
    linkKind: (link) => (isArticleLink(link) ? "article" : null),
    keyFromLink: () => null,
    target: ({ link }) => link,
    make: async (target, makers, { onFound, isCancelled, waitToSpend, onSourceWords, onWriting }) => {
      const read = await makers.readArticle(target);
      if (read.status === "read") {
        const id = await articleSourceId(read.article.url);
        onFound({ source: webSource(read.article, id), recipe: read.article.recipe, about: pageOpening(read.article) });
        await waitToSpend();
        if (isCancelled()) {
          throw new GenerationCancelledError();
        }
        onSourceWords?.(read.article.wordCount);
      }
      return makers.article(async () => read, { isCancelled, onWriting });
    },
    noun: (_linkKind, found) => {
      if (found === null) {
        return "page";
      }
      return found.recipe !== null ? "recipe" : "article";
    },
    pending: (link) => domainOf(link),
    finding: "Reading the page…",
    notFound: "We couldn't read that page.",
    card: ({ source, recipe }) => {
      const domain = source.kind === "web" ? domainOf(source.url) : null;
      return recipe !== null
        ? {
            kicker: `${sourceName(source)} · Recipe`,
            facts: {
              line: [
                recipe.totalMinutes === null ? null : recipeMinutes(recipe.totalMinutes),
                recipe.yield === null ? null : `Serves ${recipe.yield}`,
                domain,
              ]
                .filter(Boolean)
                .join(" · "),
            },
          }
        : { kicker: `${sourceName(source)} · Article`, facts: { line: [readMinutes(source), domain].filter(Boolean).join(" · ") } };
    },
    yourLink: ({ source, recipe }, minutes) =>
      recipe !== null
        ? {
            heading: "Here’s the recipe you saved.",
            line: `${sourceName(source)}’s recipe, ${RECIPE_LINE}`,
            pills: "cook",
            inside: RECIPE_INSIDE,
          }
        : {
            heading: "Here’s what’s in the article you saved.",
            line: `${source.kind === "web" ? `A ${articleReadMinutes(source.wordCount)}-minute read from ${sourceName(source)}` : `From ${sourceName(source)}`}, ${turnedInto(minutes)}`,
            pills: "readListen",
            inside: "Premise, key points, a verdict, steps, and the things it links to.",
          },
  },
};

export interface OnboardingSourceMatch {
  source: OnboardingSource;
  linkKind: OnboardingLinkKind;
}

export const onboardingSourceOf = (link: string): OnboardingSourceMatch | null => {
  for (const source of Object.values(onboardingSources)) {
    const linkKind = source.linkKind(link);
    if (linkKind !== null) {
      return { source, linkKind };
    }
  }
  return null;
};

export const foundIn = (overview: Overview): OnboardingFound => ({
  source: overview.source,
  recipe: overview.recipe ?? null,
  about: overview.source.kind === "youtube" ? (overview.source.description ?? "") : "",
});
