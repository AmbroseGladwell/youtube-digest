import type { SocialPlatform, SocialPost } from "@overview/domain";
import type { SocialVendor, VendorPost } from "./createScrapeCreatorsSocial.js";
import {
  CAPTIONS_SRT,
  FACEBOOK_LINK,
  FACEBOOK_SD_URL,
  FACEBOOK_VIDEO_ID,
  INSTAGRAM_VIDEO_URL,
  SHORTCODE,
} from "./SocialAnswerFactory.testHelper.js";

export const INSTAGRAM_REEL: SocialPost = {
  platform: "instagram",
  id: SHORTCODE,
  url: `https://www.instagram.com/reel/${SHORTCODE}/`,
  handle: "windowsillgarden",
  authorName: "Windowsill Garden",
  description: "Five ways to keep basil alive on a windowsill",
  media: "video",
  durationSeconds: 59,
  coverUrl: "https://scontent.cdninstagram.example/thumb.jpg",
  postedAt: "2026-11-21T23:29:40.000Z",
};

export const FACEBOOK_VIDEO: SocialPost = {
  ...INSTAGRAM_REEL,
  platform: "facebook",
  id: FACEBOOK_VIDEO_ID,
  url: FACEBOOK_LINK,
  handle: "windowsill.garden",
  durationSeconds: 23,
};

export const INSTAGRAM_PHOTO_POST: SocialPost = {
  ...INSTAGRAM_REEL,
  url: `https://www.instagram.com/p/${SHORTCODE}/`,
  media: "photo",
  durationSeconds: null,
};

const FILE_BY_PLATFORM = { instagram: INSTAGRAM_VIDEO_URL, facebook: FACEBOOK_SD_URL } as const;

export const foundPost = (
  post: SocialPost = INSTAGRAM_REEL,
  srt: string | null = null,
  mediaUrl: string | null = post.media === "video" ? FILE_BY_PLATFORM[post.platform] : null,
): VendorPost => ({ status: "found", post, srt, mediaUrl, credits: 1 });

export const captionedFacebookVideo = (): VendorPost => foundPost(FACEBOOK_VIDEO, CAPTIONS_SRT);

// A vendor that answers every call the same way, and remembers what it was asked.
export const scriptedSocialVendor = (answer: VendorPost = foundPost()) => {
  const asked: { platform: SocialPlatform; url: string; withTranscript: boolean }[] = [];
  const vendor: SocialVendor = {
    async post(platform, url, { withTranscript }) {
      asked.push({ platform, url, withTranscript });
      return answer.status === "found" && !withTranscript ? { ...answer, srt: null } : answer;
    },
  };
  return { vendor, asked };
};
