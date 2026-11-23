import { parseTikTokLink, sourceKey, VideoId, type StoredTranscript, type TikTokVideo } from "@overview/domain";
import type { OwnTikTokRead, TikTokPages } from "@overview/app-core";
import { parsePodcastTranscript, readTikTokPage, spokenCaptionTrack, type TikTokCaptionLink } from "@overview/transcripts";

// TikTok's pages and the CDNs its caption files come from, asked for together (docs/features/tiktok-links.md).
export const TIKTOK_ORIGINS = [
  "https://*.tiktok.com/*",
  "https://*.tiktokcdn.com/*",
  "https://*.tiktokcdn-eu.com/*",
  "https://*.tiktokcdn-us.com/*",
  "https://*.tiktokv.com/*",
];

const MACHINE_SOURCES = new Set(["ASR", "MT"]);

// Without its sharer's parameters; a short link as it came, for the browser to follow.
const pageAddressOf = (link: string): string | null => {
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

const wordsOf = async (
  fetcher: typeof fetch,
  video: TikTokVideo,
  links: TikTokCaptionLink[],
  now: () => Date,
): Promise<StoredTranscript | null> => {
  const track = spokenCaptionTrack(links);
  if (track === undefined) {
    return null;
  }
  const answer = await fetcher(track.url, { credentials: "omit" });
  const segments = answer.ok ? parsePodcastTranscript(await answer.text(), "vtt") : [];
  return segments.length === 0
    ? null
    : {
        videoId: VideoId.parse(sourceKey({ kind: "tiktok", id: video.id })),
        segments,
        generated: MACHINE_SOURCES.has(track.source.toUpperCase()),
        fetchedAt: now().toISOString(),
      };
};

// The page as a signed-out visitor sees it, read in the reader's browser: no cookies go with it.
export const readTikTokInBrowser = async (link: string, fetcher: typeof fetch = fetch, now = () => new Date()): Promise<OwnTikTokRead> => {
  const address = pageAddressOf(link);
  if (address === null) {
    return { status: "failed", reason: "not-a-video" };
  }
  const answer = await fetcher(address, { credentials: "omit" }).catch(() => null);
  if (answer === null) {
    return { status: "failed", reason: "no-answer" };
  }
  if (!answer.ok) {
    return { status: "failed", reason: answer.status === 404 ? "unavailable" : "blocked" };
  }
  const page = readTikTokPage(await answer.text());
  if (page.status !== "video") {
    return { status: "failed", reason: page.status };
  }
  const transcript = await wordsOf(fetcher, page.video, page.captionLinks, now).catch(() => null);
  return { status: "read", video: page.video, transcript };
};

// request() must be called from a user gesture or Chrome refuses it.
export const chromeTikTokPages: TikTokPages = {
  hasAccess: () => chrome.permissions.contains({ origins: TIKTOK_ORIGINS }),
  requestAccess: () => chrome.permissions.request({ origins: TIKTOK_ORIGINS }),
  read: (link) => readTikTokInBrowser(link),
};
