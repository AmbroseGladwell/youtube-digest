import {
  articleSourceId,
  formatClock,
  sourceLength,
  sourceName,
  webSource,
  youTubeSource,
  type ArticleRead,
  type Overview,
  type Source,
  type SourceKey,
} from "@overview/domain";
import type { RunOverviewGenerationOptions } from "../newOverview/api/generationPipeline.js";
import { isArticleLink } from "../newOverview/useArticleLink.js";
import { extractYouTubeVideoId, youTubeLink } from "../newOverview/util/parseYouTubeUrl.js";

export type OnboardingLinkKind = "video" | "playlist" | "article";

// What the run found at the link, before anything is written: enough to confirm and preview it.
export interface OnboardingFound {
  source: Source;
  recipe: boolean;
}

// The pipelines a run can call; the shell's hooks supply them, the kind chooses between them.
export interface OnboardingMakers {
  video: (url: string, options: RunOverviewGenerationOptions) => Promise<Overview>;
  article: (read: () => Promise<ArticleRead>, options: RunOverviewGenerationOptions) => Promise<Overview>;
  readArticle: (url: string) => Promise<ArticleRead>;
}

export interface OnboardingMakeOptions {
  onFound: (found: OnboardingFound) => void;
  isCancelled: () => boolean;
  waitToWrite: () => Promise<void>;
}

export interface OnboardingSource {
  linkKind: (link: string) => OnboardingLinkKind | null;
  keyFromLink: (link: string) => SourceKey | null;
  // What the run makes from: the link, or a playlist's chosen video. Null until it's known.
  target: (progress: { link: string; sourceKey: string | null }) => string | null;
  make: (target: string, makers: OnboardingMakers, options: OnboardingMakeOptions) => Promise<Overview>;
  noun: (linkKind: OnboardingLinkKind, found: OnboardingFound | null) => string;
  finding: string;
  notFound: string;
  fetching: string;
  byline: (found: OnboardingFound) => string;
}

const watchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

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
        onProgress: ({ video }) => onFound({ source: youTubeSource(video), recipe: false }),
      }),
    noun: (linkKind) => (linkKind === "playlist" ? "playlist" : "video"),
    finding: "Finding the video…",
    notFound: "We couldn't find that video.",
    fetching: "Fetching the video",
    byline: ({ source }) =>
      source.kind === "youtube"
        ? [source.channel, source.durationMs === null ? null : formatClock(source.durationMs / 1000)].filter(Boolean).join(" · ")
        : sourceName(source),
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
          void articleSourceId(article.url).then((id) => onFound({ source: webSource(article, id), recipe: article.recipe !== null })),
      }),
    noun: (_linkKind, found) => (found?.recipe ? "recipe" : "article"),
    finding: "Reading the page…",
    notFound: "We couldn't read that page.",
    fetching: "Reading the page",
    byline: ({ source, recipe }) => [sourceName(source), recipe ? "Recipe" : sourceLength(source)].filter(Boolean).join(" · "),
  },
};

export function onboardingSourceOf(link: string): { source: OnboardingSource; linkKind: OnboardingLinkKind } | null {
  for (const source of Object.values(onboardingSources)) {
    const linkKind = source.linkKind(link);
    if (linkKind !== null) return { source, linkKind };
  }
  return null;
}

export const foundIn = (overview: Overview): OnboardingFound => ({ source: overview.source, recipe: overview.recipe != null });
