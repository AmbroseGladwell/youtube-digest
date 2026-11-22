import { TikTokVideo, type TikTokReadFailure } from "@overview/domain";
import { z } from "zod";

export type VendorVideo =
  | { status: "found"; video: TikTokVideo; vtt: string | null; credits: number }
  | { status: "failed"; reason: TikTokReadFailure; credits: number; vendorStatus: number | null };

export interface TikTokVendor {
  video(url: string, options: { withTranscript: boolean }): Promise<VendorVideo>;
}

export interface ScrapeCreatorsOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
}

export const SCRAPECREATORS_PRICE = {
  dollarsPerCredit: 0.00188,
  checkedOn: "2026-11-22",
  source: "ScrapeCreators Freelance, $47 for 25,000 credits, from its homepage (docs/features/tiktok-links.md)",
};

const BASE_URL = "https://api.scrapecreators.com";
const TIMEOUT_MS = 30_000;

const Answer = z.object({
  success: z.boolean().optional(),
  credits_charged: z.number().optional(),
  aweme_detail: z.unknown().optional(),
  transcript: z.string().nullish(),
});

const Aweme = z.object({
  aweme_id: z.string(),
  desc: z.string().catch(""),
  create_time: z.number().optional(),
  image_post_info: z.unknown().optional(),
  author: z.object({ unique_id: z.string().min(1), nickname: z.string().catch("") }),
  video: z
    .object({
      duration: z.number().optional(),
      cover: z.object({ url_list: z.array(z.string()) }).optional(),
      cla_info: z
        .object({
          caption_infos: z
            .array(
              z.object({ lang: z.string().optional(), language_code: z.string().optional(), is_auto_generated: z.boolean().optional() }),
            )
            .nullish(),
        })
        .optional(),
    })
    .optional(),
});

const FAILURE_BY_STATUS: Record<number, TikTokReadFailure> = { 400: "not-a-video", 403: "blocked", 404: "unavailable" };

const urlOrNull = (value: string | undefined): string | null => (z.url().safeParse(value).success ? value! : null);

// Milliseconds, as TikTok counts it (docs/features/tiktok-links.md, "What is not yet checked").
const secondsOf = (milliseconds: number | undefined): number | null =>
  milliseconds !== undefined && milliseconds > 0 ? Math.max(1, Math.round(milliseconds / 1000)) : null;

const videoFromAweme = (detail: unknown): TikTokVideo | "not-a-video" | null => {
  const aweme = Aweme.safeParse(detail);
  if (!aweme.success) {
    return null;
  }
  const { aweme_id: id, desc, create_time, image_post_info, author, video } = aweme.data;
  if (image_post_info !== undefined && image_post_info !== null) {
    return "not-a-video";
  }
  const parsed = TikTokVideo.safeParse({
    id,
    url: `https://www.tiktok.com/@${author.unique_id}/video/${id}`,
    handle: author.unique_id,
    authorName: author.nickname,
    description: desc,
    durationSeconds: secondsOf(video?.duration),
    coverUrl: urlOrNull(video?.cover?.url_list[0]),
    postedAt: create_time !== undefined && create_time > 0 ? new Date(create_time * 1000).toISOString() : null,
    captions: (video?.cla_info?.caption_infos ?? []).flatMap(({ lang, language_code, is_auto_generated }) => {
      const language = lang ?? language_code;
      return language === undefined ? [] : [{ language, source: is_auto_generated === false ? "creator" : "ASR" }];
    }),
  });
  return parsed.success ? parsed.data : null;
};

// docs/features/tiktok-links.md
export const createScrapeCreatorsTikTok = ({
  apiKey,
  fetch: fetchVendor = globalThis.fetch,
  baseUrl = BASE_URL,
}: ScrapeCreatorsOptions): TikTokVendor => {
  return {
    async video(url, { withTranscript }) {
      const address = new URL("/v2/tiktok/video", baseUrl);
      address.searchParams.set("url", url);
      if (withTranscript) {
        address.searchParams.set("get_transcript", "true");
      }
      let response: Response;
      try {
        response = await fetchVendor(address, { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      } catch {
        return { status: "failed", reason: "no-answer", credits: 0, vendorStatus: null };
      }
      const body = Answer.safeParse(await response.json().catch(() => null));
      const credits = body.success ? (body.data.credits_charged ?? (response.ok ? 1 : 0)) : 0;
      if (!response.ok) {
        return { status: "failed", reason: FAILURE_BY_STATUS[response.status] ?? "no-answer", credits, vendorStatus: response.status };
      }
      if (!body.success || body.data.success === false) {
        return { status: "failed", reason: "unreadable", credits, vendorStatus: response.status };
      }
      const video = videoFromAweme(body.data.aweme_detail);
      if (video === null || video === "not-a-video") {
        return { status: "failed", reason: video ?? "unreadable", credits, vendorStatus: response.status };
      }
      return { status: "found", video, vtt: body.data.transcript ?? null, credits };
    },
  };
};
