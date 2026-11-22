import type { TikTokVideo } from "@overview/domain";
import type { TikTokVendor, VendorVideo } from "./createScrapeCreatorsTikTok.js";
import { CAPTIONS_VTT, VIDEO_ID, VIDEO_URL } from "./ScrapeCreatorsAnswerFactory.testHelper.js";

export const TIKTOK_VIDEO: TikTokVideo = {
  id: VIDEO_ID,
  url: VIDEO_URL,
  handle: "anewsroom",
  authorName: "A Newsroom",
  description: "Three things to know about the summit #news",
  durationSeconds: 80,
  coverUrl: "https://covers.tiktok.example/cover.jpeg",
  postedAt: "2026-11-21T23:29:40.000Z",
  captions: [{ language: "eng-US", source: "ASR" }],
};

export const found = (video: TikTokVideo = TIKTOK_VIDEO, vtt: string | null = CAPTIONS_VTT): VendorVideo => ({
  status: "found",
  video,
  vtt,
  credits: 1,
});

// A vendor that answers every call the same way, and remembers what it was asked.
export const scriptedTikTokVendor = (answer: VendorVideo = found()) => {
  const asked: { url: string; withTranscript: boolean }[] = [];
  const vendor: TikTokVendor = {
    async video(url, { withTranscript }) {
      asked.push({ url, withTranscript });
      return answer.status === "found" && !withTranscript ? { ...answer, vtt: null } : answer;
    },
  };
  return { vendor, asked };
};
