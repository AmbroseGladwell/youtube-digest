import {
  type TranscribeChoice,
  articleReadMinutes,
  articleSourceId,
  podcastSource,
  podcastSourceId,
  domainOf,
  formatClock,
  parsePodcastLink,
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
import type { PodcastRunRequest, RunOverviewGenerationOptions } from "../newOverview/api/generationPipeline.js";
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

// What the run found at the link, before anything is written: enough to confirm and preview it.
export interface OnboardingFound {
  source: Source;
  recipe: RecipeTimes | null;
  // What topics are suggested from besides the title: a video's description, a page's opening.
  about: string;
  // A video already checked as a recipe before the account takes the recipe's words (327u-2).
  noteKind?: NoteKind | null;
  // Whether an episode's words were found as it was read, so Your link can say it'll be
  // transcribed, or that it can't be (327v–327w-4).
  episodeWords?: TranscriptCheck | null;
}

// The pipelines a run can call; the shell's hooks supply them, the kind chooses between them.
export interface OnboardingMakers {
  video: (url: string, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readVideo: (videoId: string) => Promise<VideoRead>;
  // The transcript the read was checked from, kept in the library the overview is written into,
  // so writing finds it there rather than fetching it again.
  keepTranscript: (transcript: StoredTranscript) => Promise<void>;
  article: (read: () => Promise<ArticleRead>, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readArticle: (url: string) => Promise<ArticleRead>;
  podcast: (request: PodcastRunRequest, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readPodcast: (url: string) => Promise<PodcastRead>;
  // Free, signed out on the trial: no words are fetched (design 305c).
  checkEpisode: (episode: PodcastEpisode) => Promise<TranscriptCheck>;
}

export interface OnboardingMakeOptions {
  // An episode with no words is transcribed from its audio, as the reader chose (design 305c-2).
  transcribe?: TranscribeChoice | undefined;
  onFound: (found: OnboardingFound) => void;
  // Transcribing the episode's audio is waiting for a card, then under way.
  onTranscription?: ((progress: TranscriptionProgress) => void) | undefined;
  isCancelled: () => boolean;
  // The wait's real events (327m): the words the source was found to hold, then writing begun.
  onSourceWords?: ((words: number) => void) | undefined;
  onWriting?: (() => void) | undefined;
  // Settles once the reader has an account and their answers are in it: nothing that costs
  // anything runs before (docs/features/onboarding.md, "Nothing paid before the account").
  waitToSpend: () => Promise<void>;
}

// The confirm card (154d–154g): a kicker naming the source and its kind, the title, then facts
// that belong to the kind. A kind with no kicker keeps its facts as a byline under the title.
export interface OnboardingCard {
  kicker: string | null;
  facts: { line: string };
}

export interface OnboardingSource {
  linkKind: (link: string) => OnboardingLinkKind | null;
  keyFromLink: (link: string) => SourceKey | null;
  // What the run makes from: the link, or a playlist's chosen video. Null until it's known.
  target: (progress: { link: string; sourceKey: string | null }) => string | null;
  make: (target: string, makers: OnboardingMakers, options: OnboardingMakeOptions) => Promise<Overview>;
  // What the source is called on Your link, Topics and Moment 3, before and after it's found.
  noun: (linkKind: OnboardingLinkKind, found: OnboardingFound | null) => string;
  // What stands in for the card until the link is found: the address, or null for "finding".
  pending: (link: string) => string | null;
  finding: string;
  notFound: string;
  card: (found: OnboardingFound) => OnboardingCard;
  // Your link's words (327c, 327s–327v), with the read and listen minutes worked out in code.
  yourLink: (found: OnboardingFound, minutes: ExpectedMinutes | null) => OnboardingYourLink;
}

export interface OnboardingYourLink {
  heading: string;
  line: string;
  // A recipe is cooked rather than listened to: Cook · Read · Share.
  pills: "readListen" | "cook";
  inside: string;
  // What Looks right agrees to, said on the card (327w).
  notice?: string | null;
  // Why it can't be made, in place of the pills and Looks right (327w-3, 327w-4).
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

// Everything onboarding does differently for each kind of source, so a kind joining `Source`
// can't ship until it has an entry here (docs/features/source-identity.md, "Adding a kind").
// The web is last: it takes any address no other kind claims.
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
    noun: (linkKind, found) => (linkKind === "playlist" ? "playlist" : found?.noteKind === "recipe" ? "recipe" : "video"),
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
  // Design 106c: an episode takes the same card in a podcast's words. It claims Apple and Spotify
  // links; a show's own page is left to the web, which reads it as a page. Whether its words can be
  // found is checked before the card shows, fetching none, so Your link says it'll be transcribed
  // and Looks right is the consent, or that it can't be made (327v–327w-4). Words that turn out
  // missing after all are transcribed in the wait: a new account has the hours.
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
    noun: (_linkKind, found) => (found === null ? "page" : found.recipe !== null ? "recipe" : "article"),
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

export const onboardingSourceOf = (link: string): { source: OnboardingSource; linkKind: OnboardingLinkKind } | null => {
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
