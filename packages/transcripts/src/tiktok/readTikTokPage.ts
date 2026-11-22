import { TikTokVideo } from "@overview/domain";
import { z } from "zod";

export interface TikTokCaptionLink {
  language: string;
  source: string;
  url: string;
}

export type TikTokPage =
  | { status: "video"; video: TikTokVideo; captionLinks: TikTokCaptionLink[] }
  | { status: "unavailable" }
  | { status: "not-a-video" }
  | { status: "unreadable" };

// The spoken words first: an ASR track is what was said, and any other is a translation of it.
export const spokenCaptionTrack = <Track extends { source: string }>(tracks: readonly Track[]): Track | undefined =>
  tracks.find(({ source }) => source.toUpperCase() === "ASR") ?? tracks[0];

const PAGE_DATA = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/;

const PageItem = z.object({
  id: z.string(),
  desc: z.string().catch(""),
  createTime: z.union([z.string(), z.number()]).optional(),
  imagePost: z.unknown().optional(),
  author: z.object({ uniqueId: z.string().min(1), nickname: z.string().catch("") }),
  video: z
    .object({
      duration: z.number().optional(),
      cover: z.string().optional(),
      subtitleInfos: z
        .array(
          z.object({
            LanguageCodeName: z.string().optional(),
            Source: z.string().optional(),
            Format: z.string().optional(),
            Url: z.string().optional(),
          }),
        )
        .nullish(),
    })
    .optional(),
});

const VideoDetail = z.object({
  statusCode: z.number().optional(),
  itemInfo: z.object({ itemStruct: z.unknown() }).optional(),
});

const urlOrNull = (value: string | undefined): string | null => (z.url().safeParse(value).success ? value! : null);

const postedAt = (createTime: string | number | undefined): string | null => {
  const seconds = Number(createTime);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
};

// The extension reads the reader's own tab with this (docs/features/tiktok-links.md).
export const readTikTokPage = (html: string): TikTokPage => {
  const data = PAGE_DATA.exec(html)?.[1];
  if (data === undefined) {
    return { status: "unreadable" };
  }
  let scope: unknown;
  try {
    scope = (JSON.parse(data) as { __DEFAULT_SCOPE__?: Record<string, unknown> }).__DEFAULT_SCOPE__;
  } catch {
    return { status: "unreadable" };
  }
  const detail = VideoDetail.safeParse((scope as Record<string, unknown> | undefined)?.["webapp.video-detail"]);
  if (!detail.success) {
    return { status: "unreadable" };
  }
  if (detail.data.itemInfo === undefined) {
    return detail.data.statusCode !== undefined && detail.data.statusCode !== 0 ? { status: "unavailable" } : { status: "unreadable" };
  }

  const item = PageItem.safeParse(detail.data.itemInfo.itemStruct);
  if (!item.success) {
    return { status: "unreadable" };
  }
  const { id, desc, createTime, imagePost, author, video } = item.data;
  if (imagePost !== undefined && imagePost !== null) {
    return { status: "not-a-video" };
  }

  const captionLinks = (video?.subtitleInfos ?? []).flatMap(({ LanguageCodeName, Source, Format, Url }) =>
    Format?.toLowerCase() === "webvtt" && LanguageCodeName !== undefined && urlOrNull(Url) !== null
      ? [{ language: LanguageCodeName, source: Source ?? "unknown", url: Url! }]
      : [],
  );
  const parsed = TikTokVideo.safeParse({
    id,
    url: `https://www.tiktok.com/@${author.uniqueId}/video/${id}`,
    handle: author.uniqueId,
    authorName: author.nickname,
    description: desc,
    durationSeconds: video?.duration !== undefined && video.duration > 0 ? Math.round(video.duration) : null,
    coverUrl: urlOrNull(video?.cover),
    postedAt: postedAt(createTime),
    captions: captionLinks.map(({ language, source }) => ({ language, source })),
  });
  return parsed.success ? { status: "video", video: parsed.data, captionLinks } : { status: "unreadable" };
};
