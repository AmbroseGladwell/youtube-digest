import type { SocialPlatform } from "./SocialPost.js";

export type SocialPostLink =
  | { platform: SocialPlatform; kind: "post"; id: string; url: string }
  | { platform: SocialPlatform; kind: "share"; url: string }
  | { platform: SocialPlatform; kind: "not-a-post" };

const INSTAGRAM_HOSTS = new Set(["instagram.com", "m.instagram.com", "instagr.am"]);
const FACEBOOK_HOSTS = new Set(["facebook.com", "m.facebook.com", "web.facebook.com", "mbasic.facebook.com"]);
const FACEBOOK_SHORT_HOSTS = new Set(["fb.watch"]);
const SHORTCODE = /^[A-Za-z0-9_-]{5,40}$/;
const NUMERIC_ID = /^\d{5,25}$/;
const INSTAGRAM_POST_PATHS = new Set(["p", "reel", "reels", "tv"]);

const instagramPost = (shortcode: string | undefined, kind: string): SocialPostLink =>
  shortcode !== undefined && SHORTCODE.test(shortcode)
    ? { platform: "instagram", kind: "post", id: shortcode, url: `https://www.instagram.com/${kind === "p" ? "p" : "reel"}/${shortcode}/` }
    : { platform: "instagram", kind: "not-a-post" };

const instagramPath = (segments: readonly string[], url: URL): SocialPostLink => {
  const [first, second, third] = segments;
  if (first === "share" && second !== undefined) {
    return { platform: "instagram", kind: "share", url: url.href };
  }
  if (first !== undefined && INSTAGRAM_POST_PATHS.has(first)) {
    return instagramPost(second, first);
  }
  if (second !== undefined && INSTAGRAM_POST_PATHS.has(second)) {
    return instagramPost(third, second);
  }
  return { platform: "instagram", kind: "not-a-post" };
};

const facebookVideo = (id: string | null | undefined): SocialPostLink =>
  id !== null && id !== undefined && NUMERIC_ID.test(id)
    ? { platform: "facebook", kind: "post", id, url: `https://www.facebook.com/reel/${id}` }
    : { platform: "facebook", kind: "not-a-post" };

// A page's posts and share links name no video, so the vendor follows them and says what they hold.
const facebookPath = (segments: readonly string[], url: URL): SocialPostLink => {
  const [first, second] = segments;
  if (first === "reel") {
    return facebookVideo(second);
  }
  if (first === "watch" || first === "video.php") {
    return facebookVideo(url.searchParams.get("v"));
  }
  if (first === "share" || first === "permalink.php" || first === "story.php") {
    return { platform: "facebook", kind: "share", url: url.href };
  }
  const videos = segments.indexOf("videos");
  if (videos > 0) {
    return facebookVideo(
      segments
        .slice(videos + 1)
        .filter((segment) => NUMERIC_ID.test(segment))
        .at(-1),
    );
  }
  if (segments[1] === "posts" && segments[2] !== undefined) {
    return { platform: "facebook", kind: "share", url: url.href };
  }
  return { platform: "facebook", kind: "not-a-post" };
};

// docs/features/social-posts.md, "From a link to a post"
export const parseSocialPostLink = (link: string): SocialPostLink | null => {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  if (INSTAGRAM_HOSTS.has(host)) {
    return instagramPath(segments, url);
  }
  if (FACEBOOK_SHORT_HOSTS.has(host)) {
    return segments.length > 0 ? { platform: "facebook", kind: "share", url: url.href } : { platform: "facebook", kind: "not-a-post" };
  }
  return FACEBOOK_HOSTS.has(host) ? facebookPath(segments, url) : null;
};
