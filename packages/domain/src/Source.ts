import { z } from "zod";
import { SourceKey } from "./Brands.js";
import type { ExtractedArticle } from "./ExtractedArticle.js";
import type { PodcastEpisode } from "./PodcastEpisode.js";
import { SOCIAL_PLATFORM_NAME, SocialPlatform, type SocialPost } from "./SocialPost.js";
import type { TikTokVideo } from "./TikTokVideo.js";
import { VideoSource } from "./VideoSource.js";
import { wordCount } from "./wordCount.js";

export const YouTubeSource = VideoSource.extend({ kind: z.literal("youtube") });
export type YouTubeSource = z.infer<typeof YouTubeSource>;

// A new kind joins the union and the compiler names every reader (docs/features/source-identity.md).
export const WebSource = z.object({
  kind: z.literal("web"),
  id: SourceKey,
  url: z.url(),
  title: z.string(),
  siteName: z.string().nullable(),
  author: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  language: z.string().nullable(),
  imageUrl: z.url().nullable(),
  wordCount: z.number().int().positive(),
});
export type WebSource = z.infer<typeof WebSource>;

// The feed's identity; sharedFrom is the pasted page, the way back (docs/features/podcast-screens.md).
export const PodcastSource = z.object({
  kind: z.literal("podcast"),
  id: SourceKey,
  feedUrl: z.url(),
  guid: z.string().min(1),
  title: z.string(),
  showName: z.string(),
  publishedAt: z.iso.datetime().nullable(),
  durationMs: z.number().int().positive().nullable(),
  audioUrl: z.url(),
  pageUrl: z.url().nullable(),
  imageUrl: z.url().nullable(),
  sharedFrom: z.url(),
});
export type PodcastSource = z.infer<typeof PodcastSource>;

// The cover's address is signed and expires, so the name tile stands in once it does (docs/features/tiktok-links.md).
export const TikTokSource = z.object({
  kind: z.literal("tiktok"),
  id: SourceKey,
  url: z.url(),
  title: z.string(),
  handle: z.string().min(1),
  authorName: z.string(),
  durationMs: z.number().int().positive().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  imageUrl: z.url().nullable(),
});
export type TikTokSource = z.infer<typeof TikTokSource>;

export const SocialMedia = z.enum(["video", "photo", "text"]);
export type SocialMedia = z.infer<typeof SocialMedia>;

// One shape for both platforms, told apart by kind; the cover's address expires like TikTok's (docs/features/social-posts.md).
export const SocialSource = z.object({
  kind: SocialPlatform,
  id: SourceKey,
  url: z.url(),
  title: z.string(),
  handle: z.string().min(1).nullable(),
  authorName: z.string(),
  media: SocialMedia,
  // The description's, which a photo or text post is read for.
  wordCount: z.number().int().nonnegative(),
  durationMs: z.number().int().positive().nullable(),
  publishedAt: z.iso.datetime().nullable(),
  imageUrl: z.url().nullable(),
});
export type SocialSource = z.infer<typeof SocialSource>;

export const Source = z.discriminatedUnion("kind", [YouTubeSource, WebSource, PodcastSource, TikTokSource, SocialSource]);
export type Source = z.infer<typeof Source>;

// Short, path-safe and the same for every reader (docs/features/source-identity.md).
export const articleSourceId = async (url: string): Promise<SourceKey> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 32) as SourceKey;
};

export const webSource = (article: ExtractedArticle, id: SourceKey): WebSource => ({
  kind: "web",
  id,
  url: article.url,
  title: article.title,
  siteName: article.siteName,
  author: article.author,
  publishedAt: article.publishedAt,
  language: article.language,
  imageUrl: article.imageUrl,
  wordCount: article.wordCount,
});

export const youTubeSource = ({ fullDescription: _forGenerationOnly, ...video }: VideoSource): YouTubeSource => ({
  ...video,
  kind: "youtube",
});

const SHARER_PARAMETERS = /^(si|utm_.+|context|nd|_branch_match_id|_branch_referrer)$/;

// Spotify's si= ties to the sharer's account, so it and campaign params go (docs/features/podcast-screens.md).
export const keptSharedLink = (link: string): string => {
  const uri = /^spotify:(episode|show):([A-Za-z0-9]{22})$/.exec(link.trim());
  if (uri !== null) {
    return `https://open.spotify.com/${uri[1]}/${uri[2]}`;
  }
  const url = new URL(link.trim());
  for (const name of [...url.searchParams.keys()]) {
    if (SHARER_PARAMETERS.test(name)) {
      url.searchParams.delete(name);
    }
  }
  url.hash = "";
  return url.toString();
};

export const podcastSource = (episode: PodcastEpisode, id: SourceKey, sharedFrom: string): PodcastSource => ({
  kind: "podcast",
  id,
  feedUrl: episode.feedUrl,
  guid: episode.guid,
  title: episode.title,
  showName: episode.showName,
  publishedAt: episode.publishedAt,
  durationMs: episode.durationSeconds === null ? null : episode.durationSeconds * 1000,
  audioUrl: episode.audioUrl,
  pageUrl: episode.pageUrl,
  imageUrl: episode.imageUrl,
  sharedFrom: keptSharedLink(sharedFrom),
});

const TRAILING_HASHTAGS = /(?:\s*#[\p{L}\p{N}_]+)+\s*$/u;

// Design 130g: the caption without the hashtags after its words; only hashtags, as written; none, the creator.
export const tiktokTitle = (caption: string, handle: string): string => {
  const written = caption.trim();
  if (written === "") {
    return `A TikTok by @${handle}`;
  }
  const words = written.replace(TRAILING_HASHTAGS, "").trim();
  return words === "" ? written : words;
};

export const tiktokSource = (video: TikTokVideo): TikTokSource => ({
  kind: "tiktok",
  id: video.id as SourceKey,
  url: video.url,
  title: tiktokTitle(video.description, video.handle),
  handle: video.handle,
  authorName: video.authorName,
  durationMs: video.durationSeconds === null ? null : video.durationSeconds * 1000,
  publishedAt: video.postedAt,
  imageUrl: video.coverUrl,
});

const TITLE_CHARACTERS = 120;
const MEDIA_NOUN: Record<SocialMedia, string> = { video: "video", photo: "post", text: "post" };

const cutAtWord = (line: string): string => {
  if (line.length <= TITLE_CHARACTERS) {
    return line;
  }
  const cut = line.slice(0, TITLE_CHARACTERS);
  const space = cut.lastIndexOf(" ");
  return `${(space > TITLE_CHARACTERS / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

// The description's first line, since the rest of a long one is the post itself; none, who posted it.
export const socialTitle = (post: Pick<SocialPost, "platform" | "description" | "media" | "handle" | "authorName">): string => {
  const firstLine = post.description.split("\n").find((line) => line.trim() !== "") ?? "";
  const written = firstLine.trim();
  const words = written.replace(TRAILING_HASHTAGS, "").trim();
  if (written !== "") {
    return cutAtWord(words === "" ? written : words);
  }
  const by = post.handle === null ? post.authorName.trim() : `@${post.handle}`;
  const what = `${post.platform === "instagram" ? "An" : "A"} ${SOCIAL_PLATFORM_NAME[post.platform]} ${MEDIA_NOUN[post.media]}`;
  return by === "" ? what : `${what} by ${by}`;
};

export const socialSource = (post: SocialPost): SocialSource => ({
  kind: post.platform,
  id: post.id as SourceKey,
  url: post.url,
  title: socialTitle(post),
  handle: post.handle,
  authorName: post.authorName,
  media: post.media,
  wordCount: wordCount(post.description),
  durationMs: post.durationSeconds === null ? null : post.durationSeconds * 1000,
  publishedAt: post.postedAt,
  imageUrl: post.coverUrl,
});

export const isSocialSource = (source: Source): source is SocialSource => source.kind === "instagram" || source.kind === "facebook";

export type ClipSource = TikTokSource | SocialSource;

// A short platform video or post: named by its creator, with no time in its address.
export const isClipSource = (source: Source): source is ClipSource => source.kind === "tiktok" || isSocialSource(source);

export const clipPlatformName = (source: ClipSource): string => (source.kind === "tiktok" ? "TikTok" : SOCIAL_PLATFORM_NAME[source.kind]);

export type WrittenPost = SocialSource & { media: "photo" | "text" };

// A photo or text post is read for its description, so its note is written as an article's is (docs/features/social-posts.md).
export const isWrittenPost = (source: Source): source is WrittenPost => isSocialSource(source) && source.media !== "video";

export type WrittenSource = WebSource | WrittenPost;

export const isWrittenSource = (source: Source): source is WrittenSource => source.kind === "web" || isWrittenPost(source);

export const POST_LEAST_WORDS = 30;

// Under this, a note would only restate the post: nothing is spent on it.
export const hasTooFewWords = (post: WrittenPost): boolean => post.wordCount < POST_LEAST_WORDS;
