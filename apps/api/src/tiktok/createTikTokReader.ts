import { parseTikTokLink, sourceKey, type StoredTranscript, type TikTokRead, type TikTokReadFailure, VideoId } from "@overview/domain";
import { TranscriptFetchError, TranscriptFetchFailure } from "@overview/transcripts";
import { parsePodcastTranscript } from "../podcasts/parsePodcastTranscript.js";
import { readBodyText, type createPublicWebFetch, type PublicWebAnswer } from "../publicWeb/createPublicWebFetch.js";
import { readTikTokPage, type TikTokCaptionLink, type TikTokPage } from "./readTikTokPage.js";

type FetchPublicWeb = ReturnType<typeof createPublicWebFetch>;

export interface TikTokTranscriptAnswer {
  transcript: StoredTranscript;
  source: string;
}

const HTML = "text/html,application/xhtml+xml";
const MOST_PAGE_BYTES = 3 * 1024 * 1024;
const MOST_CAPTION_BYTES = 1024 * 1024;
const MACHINE_SOURCES = new Set(["ASR", "MT"]);

const videoPageUrl = (videoId: string): string => `https://www.tiktok.com/@/video/${videoId}`;

const fetchFailure = (reason: Extract<PublicWebAnswer, { status: "failed" }>["reason"]): TikTokReadFailure =>
  reason === "blocked" ? "blocked" : reason === "missing" ? "unavailable" : "no-answer";

// The spoken words first: an ASR track is what was said, and any other is a translation of it.
const chosenTrack = (links: readonly TikTokCaptionLink[]): TikTokCaptionLink | undefined =>
  links.find(({ source }) => source.toUpperCase() === "ASR") ?? links[0];

const TRANSCRIPT_FAILURE_OF: Record<TikTokReadFailure, TranscriptFetchFailure> = {
  "not-a-video": TranscriptFetchFailure.SOURCE_UNSUPPORTED,
  unavailable: TranscriptFetchFailure.VIDEO_UNAVAILABLE,
  blocked: TranscriptFetchFailure.SOURCE_BLOCKED,
  unreadable: TranscriptFetchFailure.MALFORMED_RESPONSE,
  "no-answer": TranscriptFetchFailure.SOURCE_UNAVAILABLE,
};

// docs/features/tiktok-links.md
export function createTikTokReader({ fetchPublicWeb, clock = () => new Date() }: { fetchPublicWeb: FetchPublicWeb; clock?: () => Date }) {
  const fetchPage = async (link: string): Promise<TikTokPage | { status: "failed"; reason: TikTokReadFailure }> => {
    const answer = await fetchPublicWeb(link, { accept: HTML });
    if (answer.status === "failed") return { status: "failed", reason: fetchFailure(answer.reason) };
    try {
      const html = await readBodyText(answer.response, MOST_PAGE_BYTES);
      return html === null ? { status: "unreadable" } : readTikTokPage(html);
    } catch {
      return { status: "failed", reason: "no-answer" };
    }
  };

  const readPage = async (link: string): Promise<{ read: TikTokRead; captionLinks: TikTokCaptionLink[] }> => {
    const page = await fetchPage(link);
    if (page.status === "video") return { read: { status: "read", video: page.video }, captionLinks: page.captionLinks };
    return { read: { status: "failed", reason: page.status === "failed" ? page.reason : page.status }, captionLinks: [] };
  };

  async function read(link: string): Promise<TikTokRead> {
    const parsed = parseTikTokLink(link);
    if (parsed === null || parsed.kind === "not-a-video") return { status: "failed", reason: "not-a-video" };
    return (await readPage(parsed.kind === "video" ? videoPageUrl(parsed.videoId) : parsed.url)).read;
  }

  async function transcript(videoId: string): Promise<TikTokTranscriptAnswer> {
    const { read: page, captionLinks } = await readPage(videoPageUrl(videoId));
    if (page.status === "failed")
      throw new TranscriptFetchError(`TikTok video ${page.reason}`, { failure: TRANSCRIPT_FAILURE_OF[page.reason] });
    const track = chosenTrack(captionLinks);
    if (track === undefined) throw new TranscriptFetchError("This TikTok has no captions", { failure: TranscriptFetchFailure.NO_CAPTIONS });

    const answer = await fetchPublicWeb(track.url, { accept: "text/vtt,*/*" });
    if (answer.status === "failed")
      throw new TranscriptFetchError(`TikTok captions ${answer.reason}`, { failure: TRANSCRIPT_FAILURE_OF[fetchFailure(answer.reason)] });
    const text = await readBodyText(answer.response, MOST_CAPTION_BYTES).catch(() => null);
    if (text === null) throw new TranscriptFetchError("TikTok captions unreadable", { failure: TranscriptFetchFailure.MALFORMED_RESPONSE });
    const segments = parsePodcastTranscript(text, "vtt");
    if (segments.length === 0)
      throw new TranscriptFetchError("This TikTok's captions are empty", { failure: TranscriptFetchFailure.NO_CAPTIONS });

    return {
      transcript: {
        videoId: VideoId.parse(sourceKey({ kind: "tiktok", id: page.video.id })),
        segments,
        generated: MACHINE_SOURCES.has(track.source.toUpperCase()),
        fetchedAt: clock().toISOString(),
      },
      source: track.source,
    };
  }

  return { read, transcript };
}

export type TikTokReader = ReturnType<typeof createTikTokReader>;
