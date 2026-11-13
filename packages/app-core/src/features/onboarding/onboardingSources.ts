import {
  articleReadMinutes,
  articleSourceId,
  podcastSource,
  podcastSourceId,
  domainOf,
  formatClock,
  recipeFigures,
  recipeMinutes,
  sourceName,
  webSource,
  youTubeSource,
  type ArticleRead,
  type PodcastRead,
  type ExtractedArticle,
  type Overview,
  type Recipe,
  type RecipeFigure,
  type Source,
  type SourceKey,
} from "@overview/domain";
import { bigPictureBudget } from "@overview/generation";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import type { PodcastRunRequest, RunOverviewGenerationOptions } from "../newOverview/api/generationPipeline.js";
import { PodcastNoTranscriptError, PodcastReadError } from "../newOverview/api/PodcastReadError.js";
import { isPlatformPodcastLink } from "../newOverview/usePodcastLink.js";
import { isArticleLink } from "../newOverview/useArticleLink.js";
import { extractYouTubeVideoId, youTubeLink } from "../newOverview/util/parseYouTubeUrl.js";
import { formatPublishedDate } from "../../util/formatPublishedDate.js";

export type OnboardingLinkKind = "video" | "playlist" | "article" | "episode";

export type RecipeTimes = Pick<Recipe, "prepMinutes" | "cookMinutes" | "totalMinutes" | "yield">;

// What the run found at the link, before anything is written: enough to confirm and preview it.
export interface OnboardingFound {
  source: Source;
  recipe: RecipeTimes | null;
  // What topics are suggested from besides the title: a video's description, a page's opening.
  about: string;
}

// The pipelines a run can call; the shell's hooks supply them, the kind chooses between them.
export interface OnboardingMakers {
  video: (url: string, options: RunOverviewGenerationOptions) => Promise<Overview>;
  article: (read: () => Promise<ArticleRead>, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readArticle: (url: string) => Promise<ArticleRead>;
  podcast: (request: PodcastRunRequest, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readPodcast: (url: string) => Promise<PodcastRead>;
}

export interface OnboardingMakeOptions {
  onFound: (found: OnboardingFound) => void;
  isCancelled: () => boolean;
  waitToWrite: () => Promise<void>;
}

// The confirm card (154d–154g): a kicker naming the source and its kind, the title, then facts
// that belong to the kind. A kind with no kicker keeps its facts as a byline under the title.
export interface OnboardingCard {
  kicker: string | null;
  facts: { line: string } | { figures: RecipeFigure[] };
}

export interface OnboardingSection {
  name: string;
  // Taken from the page rather than written, so it's known as soon as the read lands (154h).
  fromPage: boolean;
}

export interface OnboardingTeaser {
  byline: string;
  first: { label: string; text: string };
  locked: string;
}

export interface OnboardingSource {
  linkKind: (link: string) => OnboardingLinkKind | null;
  keyFromLink: (link: string) => SourceKey | null;
  // What the run makes from: the link, or a playlist's chosen video. Null until it's known.
  target: (progress: { link: string; sourceKey: string | null }) => string | null;
  make: (target: string, makers: OnboardingMakers, options: OnboardingMakeOptions) => Promise<Overview>;
  // The word in "Is this the right …?", before and after the link is found.
  noun: (linkKind: OnboardingLinkKind, found: OnboardingFound | null) => string;
  lead: (found: OnboardingFound | null) => string;
  // What stands in for the card until the link is found: the address, or null for "finding".
  pending: (link: string) => string | null;
  finding: string;
  notFound: string;
  fetching: string;
  // What the preview says once the source is in hand and writing waits on the questions.
  ready: (found: OnboardingFound | null) => string;
  card: (found: OnboardingFound) => OnboardingCard;
  sections: (found: OnboardingFound | null) => readonly OnboardingSection[];
  teaser: (overview: Overview) => OnboardingTeaser;
}

const PAGE_OPENING_CHARACTERS = 3000;

const pageOpening = (article: ExtractedArticle): string =>
  article.sections
    .map(({ heading, text }) => (heading === null ? text : `${heading} ${text}`))
    .join(" ")
    .slice(0, PAGE_OPENING_CHARACTERS);

const watchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

const BIG_PICTURE_FROM_MS = 10 * 60_000;

// Listed only when the source is long enough to earn one: an article's words are known, and a
// video of ten minutes clears the threshold at any speaking pace (docs/features/overview-generation-decisions.md).
const mayEarnBigPicture = (source: Source): boolean =>
  source.kind === "web" ? bigPictureBudget(source.wordCount) > 0 : source.durationMs !== null && source.durationMs >= BIG_PICTURE_FROM_MS;

const writtenSections = (found: OnboardingFound | null): readonly OnboardingSection[] =>
  [
    "Premise",
    ...(found !== null && mayEarnBigPicture(found.source) ? ["Big picture"] : []),
    "Key points",
    "How to apply",
    "Verdict",
    "Chapters",
  ].map((name) => ({ name, fromPage: false }));
const RECIPE_SECTIONS: readonly OnboardingSection[] = [
  { name: "Summary", fromPage: false },
  { name: "Ingredients", fromPage: true },
  { name: "Method", fromPage: true },
];

const OVERVIEW_LEAD = "We'll turn it into an overview you can read, listen to and come back to.";
const overviewLocked = (overview: Overview): string =>
  `${overview.bigPicture ? "Big picture, key points" : "Key points"}, How to apply and Verdict open with an account.`;

const videoFacts = (source: Source): string =>
  source.kind === "youtube"
    ? [source.channel, source.durationMs === null ? null : formatClock(source.durationMs / 1000)].filter(Boolean).join(" · ")
    : sourceName(source);

const episodeLength = (source: Source): string | null =>
  source.kind === "podcast" && source.durationMs !== null ? recipeMinutes(Math.round(source.durationMs / 60_000)) : null;

// "1 hr 56 min · 10 Nov 2026", or the date alone when the feed gives no length (design 106b).
const episodeFacts = (source: Source): string =>
  [episodeLength(source), source.publishedAt === null ? null : formatPublishedDate(source.publishedAt)].filter(Boolean).join(" · ");

const readMinutes = (source: Source): string | null => (source.kind === "web" ? `${articleReadMinutes(source.wordCount)} min read` : null);

// Everything onboarding does differently for each kind of source, so a kind joining `Source`
// can't ship until it has an entry here (docs/features/source-identity.md, "Adding a kind").
// The web is last: it takes any address no other kind claims.
export const onboardingSources: { readonly [Kind in Source["kind"]]: OnboardingSource } = {
  youtube: {
    linkKind: (link) => {
      const parsed = youTubeLink(link);
      if (parsed === null) return null;
      if (parsed.kind === "playlist") return "playlist";
      return parsed.kind === "unfollowable" && parsed.videoUrl === null ? null : "video";
    },
    keyFromLink: (link) => {
      const parsed = youTubeLink(link);
      const videoUrl = parsed === null || parsed.kind === "playlist" ? null : parsed.videoUrl;
      return videoUrl === null ? null : (extractYouTubeVideoId(videoUrl) as SourceKey | null);
    },
    target: ({ sourceKey }) => (sourceKey === null ? null : watchUrl(sourceKey)),
    make: (target, makers, { onFound, isCancelled, waitToWrite }) =>
      makers.video(target, {
        isCancelled,
        waitToWrite,
        onProgress: ({ video, transcriptOpening }) =>
          onFound({
            source: youTubeSource(video),
            recipe: null,
            about: [video.description ?? "", transcriptOpening].filter((part) => part !== "").join("\n\n"),
          }),
      }),
    noun: (linkKind) => (linkKind === "playlist" ? "playlist" : "video"),
    lead: () => OVERVIEW_LEAD,
    pending: () => null,
    finding: "Finding the video…",
    notFound: "We couldn't find that video.",
    fetching: "Fetching the video",
    ready: () => "Transcript ready",
    card: ({ source }) => ({ kicker: null, facts: { line: videoFacts(source) } }),
    sections: writtenSections,
    teaser: (overview) => ({
      byline: videoFacts(overview.source),
      first: { label: "Premise", text: overview.inOneLine },
      locked: overviewLocked(overview),
    }),
  },
  // Design 106c: an episode takes the same card in a podcast's words. It claims Apple and Spotify
  // links; a show's own page is left to the web, which reads it as a page. It is found, and its
  // words with it, before the card shows, as a video's transcript is fetched before its card
  // does, so an episode with no words stops at the confirm step (106i).
  podcast: {
    linkKind: (link) => (isPlatformPodcastLink(link) ? "episode" : null),
    keyFromLink: () => null,
    target: ({ link }) => link,
    make: async (target, makers, { onFound, isCancelled, waitToWrite }) => {
      const read = await makers.readPodcast(target);
      if (read.status === "failed") throw new PodcastReadError(read.reason, read.showName ?? null);
      const id = await podcastSourceId(read.episode);
      return makers
        .podcast(
          { episode: read.episode, sharedFrom: target },
          {
            isCancelled,
            waitToWrite,
            onEpisodeWords: () => onFound({ source: podcastSource(read.episode, id, target), recipe: null, about: read.episode.notes }),
          },
        )
        .catch((error: unknown) => {
          if (error instanceof TranscriptFetchError && error.failure === TranscriptFetchFailure.NO_CAPTIONS) {
            throw new PodcastNoTranscriptError();
          }
          throw error;
        });
    },
    noun: (_linkKind, found) => (found === null ? "page" : "episode"),
    lead: () => OVERVIEW_LEAD,
    pending: (link) => domainOf(link),
    finding: "Finding the episode…",
    notFound: "We couldn't find that episode.",
    fetching: "Finding the episode",
    ready: () => "Transcript ready",
    card: ({ source }) => ({
      kicker: `${sourceName(source)} · Podcast`,
      facts: { line: episodeFacts(source) },
    }),
    sections: writtenSections,
    teaser: (overview) => ({
      byline: [sourceName(overview.source), "Podcast", episodeLength(overview.source)].filter(Boolean).join(" · "),
      first: { label: "Premise", text: overview.inOneLine },
      locked: overviewLocked(overview),
    }),
  },
  web: {
    linkKind: (link) => (isArticleLink(link) ? "article" : null),
    keyFromLink: () => null,
    target: ({ link }) => link,
    make: (target, makers, { onFound, isCancelled, waitToWrite }) =>
      makers.article(() => makers.readArticle(target), {
        isCancelled,
        waitToWrite,
        onArticleRead: (article) =>
          void articleSourceId(article.url).then((id) =>
            onFound({ source: webSource(article, id), recipe: article.recipe, about: pageOpening(article) }),
          ),
      }),
    noun: (_linkKind, found) => (found === null ? "page" : found.recipe !== null ? "recipe" : "article"),
    lead: (found) => (found?.recipe ? "We'll turn it into a recipe you can read, cook from and come back to." : OVERVIEW_LEAD),
    pending: (link) => domainOf(link),
    finding: "Reading the page…",
    notFound: "We couldn't read that page.",
    fetching: "Reading the page",
    ready: (found) => (found?.recipe ? "Recipe read" : "Page read"),
    card: ({ source, recipe }) =>
      recipe !== null
        ? { kicker: `${sourceName(source)} · Recipe`, facts: { figures: recipeFigures(recipe) } }
        : {
            kicker: `${sourceName(source)} · Article`,
            facts: {
              line: [source.kind === "web" && source.author ? `By ${source.author}` : null, readMinutes(source)]
                .filter(Boolean)
                .join(" · "),
            },
          },
    sections: (found) => (found?.recipe ? RECIPE_SECTIONS : writtenSections(found)),
    teaser: (overview) =>
      overview.recipe
        ? {
            byline: [
              sourceName(overview.source),
              "Recipe",
              overview.recipe.totalMinutes === null ? null : recipeMinutes(overview.recipe.totalMinutes),
            ]
              .filter(Boolean)
              .join(" · "),
            first: { label: "Summary", text: overview.recipe.summary },
            locked: "The ingredients and method open with an account.",
          }
        : {
            byline: [sourceName(overview.source), "Article", readMinutes(overview.source)].filter(Boolean).join(" · "),
            first: { label: "Premise", text: overview.inOneLine },
            locked: overviewLocked(overview),
          },
  },
};

export function onboardingSourceOf(link: string): { source: OnboardingSource; linkKind: OnboardingLinkKind } | null {
  for (const source of Object.values(onboardingSources)) {
    const linkKind = source.linkKind(link);
    if (linkKind !== null) return { source, linkKind };
  }
  return null;
}

export const foundIn = (overview: Overview): OnboardingFound => ({
  source: overview.source,
  recipe: overview.recipe ?? null,
  about: overview.source.kind === "youtube" ? (overview.source.description ?? "") : "",
});
