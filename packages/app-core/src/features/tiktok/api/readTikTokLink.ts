import type { TikTokRead, TikTokVideo } from "@overview/domain";
import type { TikTokPages } from "../../../app/TikTokPagesContext.js";
import type { TikTokWords } from "../../newOverview/api/generationPipeline.js";

export type TikTokLinkRead = { status: "read"; video: TikTokVideo; words: TikTokWords | null } | Extract<TikTokRead, { status: "failed" }>;

export interface TikTokReaders {
  own: TikTokPages | null;
  server: (link: string) => Promise<TikTokRead>;
}

// The page's own answer that it isn't a video is believed; anything else it couldn't settle goes to the vendor.
const settledByOwnRead = (reason: string): boolean => reason === "not-a-video";

// Own read first, the vendor only when it can't answer with words: docs/features/tiktok-links.md, "Who reads TikTok".
export const readTikTokLink = async (link: string, { own, server }: TikTokReaders): Promise<TikTokLinkRead> => {
  if (own !== null && (await own.hasAccess())) {
    const read = await own.read(link).catch(() => null);
    if (read?.status === "read" && read.transcript !== null) {
      return { status: "read", video: read.video, words: { transcript: read.transcript, source: "tiktok-tab" } };
    }
    if (read?.status === "failed" && settledByOwnRead(read.reason)) {
      return { status: "failed", reason: "not-a-video" };
    }
  }
  const read = await server(link);
  if (read.status === "failed") {
    return read;
  }
  return {
    status: "read",
    video: read.video,
    words: read.transcript === null ? null : { transcript: read.transcript, source: "tiktok-vendor" },
  };
};
