import { parseTikTokLink, sourceKey, type StoredTranscript, type TikTokRead, type TikTokReadFailure, VideoId } from "@overview/domain";
import { spokenCaptionTrack, TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { parsePodcastTranscript } from "../podcasts/parsePodcastTranscript.js";
import type { TikTokVendor } from "./createScrapeCreatorsTikTok.js";

export interface TikTokTranscriptAnswer {
  transcript: StoredTranscript;
  source: string;
}

// What a call spent at the vendor, and what it answered, for the cost tally and the log.
export type Spend = (credits: number, vendorStatus: number | null) => Promise<void>;

export interface TikTokReaderOptions {
  vendor: TikTokVendor;
  clock?: () => Date;
}

const MACHINE_SOURCES = new Set(["ASR", "MT"]);

const TRANSCRIPT_FAILURE_OF: Record<TikTokReadFailure, TranscriptFetchFailure> = {
  "not-a-video": TranscriptFetchFailure.SOURCE_UNSUPPORTED,
  unavailable: TranscriptFetchFailure.VIDEO_UNAVAILABLE,
  blocked: TranscriptFetchFailure.SOURCE_BLOCKED,
  unreadable: TranscriptFetchFailure.MALFORMED_RESPONSE,
  "no-answer": TranscriptFetchFailure.SOURCE_UNAVAILABLE,
};

// A video link without its sharer's parameters; a short link as it came, for the vendor to follow.
const vendorLinkOf = (link: string): string | null => {
  const parsed = parseTikTokLink(link);
  if (parsed === null || parsed.kind === "not-a-video") {
    return null;
  }
  if (parsed.kind === "short") {
    return parsed.url;
  }
  const url = new URL(link.trim());
  return url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "") === "tiktok.com" && url.pathname.startsWith("/@")
    ? `https://www.tiktok.com${url.pathname}`
    : `https://www.tiktok.com/@/video/${parsed.videoId}`;
};

// Through the vendor only, never TikTok's pages (docs/features/tiktok-links.md).
export const createTikTokReader = ({ vendor, clock = () => new Date() }: TikTokReaderOptions) => {
  const read = async (link: string, spend: Spend): Promise<TikTokRead> => {
    const vendorLink = vendorLinkOf(link);
    if (vendorLink === null) {
      return { status: "failed", reason: "not-a-video" };
    }
    const answer = await vendor.video(vendorLink, { withTranscript: false });
    await spend(answer.credits, answer.status === "failed" ? answer.vendorStatus : null);
    return answer.status === "found" ? { status: "read", video: answer.video } : { status: "failed", reason: answer.reason };
  };

  const transcript = async (videoUrl: string, spend: Spend): Promise<TikTokTranscriptAnswer> => {
    const vendorLink = vendorLinkOf(videoUrl);
    if (vendorLink === null) {
      throw new TranscriptFetchError("Not a TikTok video", { failure: TranscriptFetchFailure.SOURCE_UNSUPPORTED });
    }
    const answer = await vendor.video(vendorLink, { withTranscript: true });
    await spend(answer.credits, answer.status === "failed" ? answer.vendorStatus : null);
    if (answer.status === "failed") {
      throw new TranscriptFetchError(`TikTok video ${answer.reason}`, { failure: TRANSCRIPT_FAILURE_OF[answer.reason] });
    }
    const segments = answer.vtt === null ? [] : parsePodcastTranscript(answer.vtt, "vtt");
    if (segments.length === 0) {
      throw new TranscriptFetchError("This TikTok has no captions", { failure: TranscriptFetchFailure.NO_CAPTIONS });
    }
    const source = spokenCaptionTrack(answer.video.captions)?.source ?? "ASR";
    return {
      transcript: {
        videoId: VideoId.parse(sourceKey({ kind: "tiktok", id: answer.video.id })),
        segments,
        generated: MACHINE_SOURCES.has(source.toUpperCase()),
        fetchedAt: clock().toISOString(),
      },
      source,
    };
  };

  return { read, transcript };
};

export type TikTokReader = ReturnType<typeof createTikTokReader>;
