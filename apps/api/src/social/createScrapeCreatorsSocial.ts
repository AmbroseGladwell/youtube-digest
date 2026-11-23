import { SocialPost, type SocialPlatform, type SocialReadFailure } from "@overview/domain";
import { z } from "zod";
import { SCRAPECREATORS_BASE_URL } from "../tiktok/createScrapeCreatorsTikTok.js";

export type VendorPost =
  | { status: "found"; post: SocialPost; srt: string | null; mediaUrl: string | null; credits: number }
  | { status: "failed"; reason: SocialReadFailure; credits: number; vendorStatus: number | null };

export interface SocialVendor {
  post(platform: SocialPlatform, url: string, options: { withTranscript: boolean }): Promise<VendorPost>;
}

export interface ScrapeCreatorsSocialOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
}

const TIMEOUT_MS = 30_000;
const PATHS: Record<SocialPlatform, string> = { instagram: "/v1/instagram/post", facebook: "/v1/facebook/post" };

const Answer = z.object({ success: z.boolean().optional(), credits_charged: z.number().optional(), error: z.string().optional() });

const Caption = z.object({ edges: z.array(z.object({ node: z.object({ text: z.string() }) })) });

// Only what the post is; the answer's comments are never read (docs/features/social-posts.md).
const InstagramMedia = z.object({
  __typename: z.string(),
  shortcode: z.string(),
  is_video: z.boolean().optional(),
  video_url: z.string().nullish(),
  video_duration: z.number().nullish(),
  display_url: z.string().nullish(),
  thumbnail_src: z.string().nullish(),
  taken_at_timestamp: z.number().nullish(),
  owner: z.object({ username: z.string().min(1), full_name: z.string().nullish() }),
  edge_media_to_caption: Caption.optional(),
});

const InstagramAnswer = z.object({ data: z.object({ xdt_shortcode_media: z.unknown() }) });

const FacebookAnswer = z.object({
  post_id: z.string().nullish(),
  description: z.string().nullish(),
  creation_time: z.string().nullish(),
  url: z.string().nullish(),
  image_url: z.string().nullish(),
  video: z
    .object({
      id: z.string(),
      sd_url: z.string().nullish(),
      hd_url: z.string().nullish(),
      length_in_second: z.number().nullish(),
      thumbnail: z.string().nullish(),
    })
    .nullish(),
  author: z.object({ name: z.string().nullish(), handle: z.string().nullish() }).nullish(),
  transcript: z.string().nullish(),
});

const FAILURE_BY_STATUS: Record<number, SocialReadFailure> = { 400: "not-a-post", 403: "blocked", 404: "unavailable" };

const httpsOrNull = (value: string | null | undefined): string | null =>
  value !== null && value !== undefined && URL.parse(value)?.protocol === "https:" ? value : null;

const wholeSeconds = (seconds: number | null | undefined): number | null =>
  seconds !== null && seconds !== undefined && seconds > 0 ? Math.max(1, Math.round(seconds)) : null;

const isoOrNull = (value: string | null | undefined): string | null => {
  const time = value === null || value === undefined ? Number.NaN : Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
};

interface Found {
  post: SocialPost;
  srt: string | null;
  mediaUrl: string | null;
}

const instagramPostOf = (body: unknown): Found | null => {
  const media = InstagramMedia.safeParse(InstagramAnswer.safeParse(body).data?.data.xdt_shortcode_media);
  if (!media.success) {
    return null;
  }
  const { __typename, shortcode, is_video, video_url, video_duration, display_url, thumbnail_src, taken_at_timestamp, owner } = media.data;
  const isVideo = is_video === true && __typename === "XDTGraphVideo";
  const parsed = SocialPost.safeParse({
    platform: "instagram",
    id: shortcode,
    url: `https://www.instagram.com/${isVideo ? "reel" : "p"}/${shortcode}/`,
    handle: owner.username,
    authorName: owner.full_name ?? "",
    description: media.data.edge_media_to_caption?.edges[0]?.node.text ?? "",
    media: isVideo ? "video" : "photo",
    durationSeconds: isVideo ? wholeSeconds(video_duration) : null,
    coverUrl: httpsOrNull(thumbnail_src ?? display_url),
    postedAt: taken_at_timestamp !== null && taken_at_timestamp !== undefined ? new Date(taken_at_timestamp * 1000).toISOString() : null,
  });
  return parsed.success ? { post: parsed.data, srt: null, mediaUrl: isVideo ? httpsOrNull(video_url) : null } : null;
};

const facebookMediaOf = (hasVideo: boolean, hasImage: boolean): SocialPost["media"] => {
  if (hasVideo) {
    return "video";
  }
  return hasImage ? "photo" : "text";
};

const facebookPostOf = (body: unknown): Found | null => {
  const answer = FacebookAnswer.safeParse(body);
  if (!answer.success) {
    return null;
  }
  const { post_id, description, creation_time, url, image_url, video, author, transcript } = answer.data;
  const id = video?.id ?? post_id;
  const media = facebookMediaOf(video !== null && video !== undefined, httpsOrNull(image_url) !== null);
  const parsed = SocialPost.safeParse({
    platform: "facebook",
    id,
    url: httpsOrNull(url) ?? `https://www.facebook.com/reel/${id}`,
    handle: author?.handle ?? null,
    authorName: author?.name ?? "",
    description: description ?? "",
    media,
    durationSeconds: wholeSeconds(video?.length_in_second),
    coverUrl: httpsOrNull(video?.thumbnail ?? image_url),
    postedAt: isoOrNull(creation_time),
  });
  if (!parsed.success) {
    return null;
  }
  const srt = transcript === null || transcript === undefined || transcript.trim() === "" ? null : transcript;
  return { post: parsed.data, srt, mediaUrl: httpsOrNull(video?.sd_url ?? video?.hd_url) };
};

// docs/features/social-posts.md
export const createScrapeCreatorsSocial = ({
  apiKey,
  fetch: fetchVendor = globalThis.fetch,
  baseUrl = SCRAPECREATORS_BASE_URL,
}: ScrapeCreatorsSocialOptions): SocialVendor => {
  return {
    async post(platform, url, { withTranscript }) {
      const address = new URL(PATHS[platform], baseUrl);
      address.searchParams.set("url", url);
      if (withTranscript && platform === "facebook") {
        address.searchParams.set("get_transcript", "true");
      }
      let response: Response;
      try {
        response = await fetchVendor(address, { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch {
        return { status: "failed", reason: "no-answer", credits: 0, vendorStatus: null };
      }
      const json: unknown = await response.json().catch(() => null);
      const body = Answer.safeParse(json);
      const credits = body.success ? (body.data.credits_charged ?? (response.ok ? 1 : 0)) : 0;
      if (!response.ok) {
        return { status: "failed", reason: FAILURE_BY_STATUS[response.status] ?? "no-answer", credits, vendorStatus: response.status };
      }
      if (!body.success || body.data.success === false) {
        const reason = body.data?.error === "not_found" ? "unavailable" : "unreadable";
        return { status: "failed", reason, credits, vendorStatus: response.status };
      }
      const found = platform === "instagram" ? instagramPostOf(json) : facebookPostOf(json);
      return found === null
        ? { status: "failed", reason: "unreadable", credits, vendorStatus: response.status }
        : { status: "found", ...found, credits };
    },
  };
};
