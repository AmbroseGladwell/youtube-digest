import type { ArticleLink } from "../useArticleLink.js";
import { episodeActionOf, type EpisodeAction } from "../../podcasts/util/episodeActionOf.js";
import type { PodcastLink } from "../usePodcastLink.js";
import type { TikTokLink } from "../useTikTokLink.js";
import type { SocialLink } from "../useSocialLink.js";

export interface PastedLinkState {
  podcastShown: boolean;
  tiktokShown: boolean;
  socialShown: boolean;
  // A page that may be an episode is still being read as one.
  reading: boolean;
  // Offered even while it waits on `reading`.
  generateOffered: boolean;
  episodeAction: EpisodeAction | null;
}

export interface PastedPodcast {
  link: PodcastLink;
  platformLink: boolean;
}

// One with no captions is offered to transcribe as an episode is.
const tiktokActionOf = (tiktok: TikTokLink): EpisodeAction | null =>
  tiktok.status === "found" && tiktok.words === null && tiktok.stop === null && tiktok.transcription !== null
    ? episodeActionOf({ state: "none", transcription: tiktok.transcription })
    : null;

// A TikTok link is never an article's: it is read as a TikTok, or refused as one (130a, 130l–130n).
const tiktokState = (tiktok: TikTokLink): PastedLinkState => {
  const episodeAction = tiktokActionOf(tiktok);
  return {
    podcastShown: false,
    tiktokShown: true,
    socialShown: false,
    reading: tiktok.status === "reading",
    generateOffered: (tiktok.status === "found" && tiktok.stop === null && episodeAction?.kind !== "stop") || tiktok.status === "reading",
    episodeAction,
  };
};

// A video without words is offered to transcribe as a TikTok is; a photo or text post never is.
const socialActionOf = (social: SocialLink): EpisodeAction | null =>
  social.status === "found" &&
  social.post.media === "video" &&
  social.words === null &&
  social.stop === null &&
  social.transcription !== null
    ? episodeActionOf({ state: "none", transcription: social.transcription })
    : null;

// An Instagram or Facebook link is never an article's: it is read as a post, or refused as one.
const socialState = (social: SocialLink): PastedLinkState => {
  const episodeAction = socialActionOf(social);
  return {
    podcastShown: false,
    tiktokShown: false,
    socialShown: true,
    reading: social.status === "reading",
    generateOffered: (social.status === "found" && social.stop === null && episodeAction?.kind !== "stop") || social.status === "reading",
    episodeAction,
  };
};

// A non-platform page is an episode only once our server has found one there.
export const pastedLinkState = (
  article: ArticleLink,
  podcast: PastedPodcast,
  tiktok: TikTokLink = { status: "none" },
  social: SocialLink = { status: "none" },
): PastedLinkState => {
  if (tiktok.status !== "none") {
    return tiktokState(tiktok);
  }
  if (social.status !== "none") {
    return socialState(social);
  }
  const podcastShown = podcast.platformLink
    ? podcast.link.status !== "none"
    : podcast.link.status === "found" || podcast.link.status === "held";
  if (podcastShown) {
    const episodeAction = podcast.link.status === "found" ? episodeActionOf(podcast.link.words) : null;
    return {
      podcastShown,
      tiktokShown: false,
      socialShown: false,
      reading: podcast.link.status === "reading" || episodeAction?.kind === "waiting",
      generateOffered: (podcast.link.status === "found" && episodeAction?.kind !== "stop") || podcast.link.status === "reading",
      episodeAction,
    };
  }
  return {
    podcastShown,
    tiktokShown: false,
    socialShown: false,
    reading: podcast.link.status === "reading" || article.status === "reading",
    generateOffered: article.status !== "held" && article.status !== "failed",
    episodeAction: null,
  };
};
