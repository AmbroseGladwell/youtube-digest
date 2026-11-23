import { parseSocialPostLink, sourceKey, type SocialPost, type SocialRead, type StoredTranscript, VideoId } from "@overview/domain";
import { parsePodcastTranscript } from "@overview/transcripts";
import type { Spend } from "../tiktok/createTikTokReader.js";
import type { SocialVendor } from "./createScrapeCreatorsSocial.js";

interface LookOptions {
  withTranscript: boolean;
}

// The video file's address stays on our server, for speech-to-text only (docs/features/social-posts.md).
export interface SocialLook {
  read: SocialRead;
  mediaUrl: string | null;
}

export interface SocialPostReaderOptions {
  vendor: SocialVendor;
  clock?: () => Date;
}

// Through the vendor only, never the platforms' pages, with a Facebook video's captions in the same call.
export const createSocialPostReader = ({ vendor, clock = () => new Date() }: SocialPostReaderOptions) => {
  const wordsOf = (post: SocialPost, srt: string | null): StoredTranscript | null => {
    const segments = srt === null ? [] : parsePodcastTranscript(srt, "srt");
    if (segments.length === 0) {
      return null;
    }
    return {
      videoId: VideoId.parse(sourceKey({ kind: post.platform, id: post.id })),
      segments,
      generated: true,
      fetchedAt: clock().toISOString(),
    };
  };

  const look = async (link: string, spend: Spend, { withTranscript }: LookOptions): Promise<SocialLook> => {
    const parsed = parseSocialPostLink(link);
    if (parsed === null || parsed.kind === "not-a-post") {
      return { read: { status: "failed", reason: "not-a-post" }, mediaUrl: null };
    }
    const answer = await vendor.post(parsed.platform, parsed.url, { withTranscript });
    await spend(answer.credits, answer.status === "failed" ? answer.vendorStatus : null);
    return answer.status === "found"
      ? { read: { status: "read", post: answer.post, transcript: wordsOf(answer.post, answer.srt) }, mediaUrl: answer.mediaUrl }
      : { read: { status: "failed", reason: answer.reason }, mediaUrl: null };
  };

  return { look };
};

export type SocialPostReader = ReturnType<typeof createSocialPostReader>;
