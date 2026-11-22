import { parseTikTokLink, sourceKey, type StoredTranscript, type TikTokRead, type TikTokVideo, VideoId } from "@overview/domain";
import { parsePodcastTranscript, spokenCaptionTrack } from "@overview/transcripts";
import type { TikTokVendor } from "./createScrapeCreatorsTikTok.js";

// What a call spent at the vendor, and what it answered, for the cost tally and the log.
export type Spend = (credits: number, vendorStatus: number | null) => Promise<void>;

export interface TikTokReaderOptions {
  vendor: TikTokVendor;
  clock?: () => Date;
}

const MACHINE_SOURCES = new Set(["ASR", "MT"]);

// A video link without its sharer's parameters; a short link as it came, for the vendor to follow.
const vendorLinkOf = (link: string): string | null => {
  const parsed = parseTikTokLink(link);
  if (parsed === null || parsed.kind === "not-a-video") {
    return null;
  }
  if (parsed.kind === "short") {
    return parsed.url;
  }
  const { pathname } = new URL(link.trim());
  return pathname.startsWith("/@") ? `https://www.tiktok.com${pathname}` : `https://www.tiktok.com/@/video/${parsed.videoId}`;
};

// Through the vendor only, never TikTok's pages, with the words in the same call (docs/features/tiktok-links.md).
export const createTikTokReader = ({ vendor, clock = () => new Date() }: TikTokReaderOptions) => {
  const wordsOf = (video: TikTokVideo, vtt: string | null): StoredTranscript | null => {
    const segments = vtt === null ? [] : parsePodcastTranscript(vtt, "vtt");
    if (segments.length === 0) {
      return null;
    }
    const source = spokenCaptionTrack(video.captions)?.source ?? "ASR";
    return {
      videoId: VideoId.parse(sourceKey({ kind: "tiktok", id: video.id })),
      segments,
      generated: MACHINE_SOURCES.has(source.toUpperCase()),
      fetchedAt: clock().toISOString(),
    };
  };

  const read = async (link: string, spend: Spend): Promise<TikTokRead> => {
    const vendorLink = vendorLinkOf(link);
    if (vendorLink === null) {
      return { status: "failed", reason: "not-a-video" };
    }
    const answer = await vendor.video(vendorLink, { withTranscript: true });
    await spend(answer.credits, answer.status === "failed" ? answer.vendorStatus : null);
    return answer.status === "found"
      ? { status: "read", video: answer.video, transcript: wordsOf(answer.video, answer.vtt) }
      : { status: "failed", reason: answer.reason };
  };

  return { read };
};

export type TikTokReader = ReturnType<typeof createTikTokReader>;
