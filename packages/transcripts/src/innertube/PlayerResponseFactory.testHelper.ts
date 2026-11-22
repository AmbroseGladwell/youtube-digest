import type { PlayerResponse } from "./PlayerResponse.js";

// Trimmed from a real ANDROID response, keeping the shapes that surprise.
export const FIXTURE_VIDEO_ID = "tL9Lw250spc";

export const CAPTION_BASE_URL = "https://www.youtube.com/api/timedtext?v=tL9Lw250spc&ei=2ECva&lang=en&fmt=srv3";

export const makePlayerResponse = (overrides: Partial<PlayerResponse> = {}): PlayerResponse => {
  return {
    playabilityStatus: { status: "OK" },
    videoDetails: {
      videoId: FIXTURE_VIDEO_ID,
      title: "Why does every mammal get 1 billion heartbeats in their life?",
      author: "Veritasium",
      shortDescription: "The hidden math that governs life.",
      lengthSeconds: "2132",
      isLiveContent: false,
      thumbnail: {
        thumbnails: [
          { url: "https://i.ytimg.com/vi_webp/tL9Lw250spc/default.webp", width: 120, height: 90 },
          { url: "https://i.ytimg.com/vi_webp/tL9Lw250spc/mqdefault.webp", width: 320, height: 180 },
          { url: "https://i.ytimg.com/vi_webp/tL9Lw250spc/sddefault.webp", width: 640, height: 480 },
        ],
      },
    },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          { baseUrl: CAPTION_BASE_URL, languageCode: "en", vssId: ".en" },
          { baseUrl: `${CAPTION_BASE_URL}&asr`, languageCode: "en", kind: "asr", vssId: "a.en" },
        ],
      },
    },
    ...overrides,
  };
};

// The WEB client is unplayable and has no captions, but alone carries a publish date.
export const makeMetadataResponse = (publishDate = "2026-07-25T10:29:09-07:00"): PlayerResponse => {
  return {
    playabilityStatus: { status: "UNPLAYABLE" },
    microformat: { playerMicroformatRenderer: { publishDate, uploadDate: publishDate } },
  };
};

// Two written cues and one machine-heard, in the shapes json3 actually emits.
export const JSON3_WRITTEN = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 2706, segs: [{ utf8: "How much LSD should\nyou give an elephant?" }] },
    { tStartMs: 2706, dDurationMs: 1614, segs: [{ utf8: "(mellow music)\nWell, to a reasonable person," }] },
  ],
});

export const JSON3_WITH_NOISE = JSON.stringify({
  events: [
    { tStartMs: 0, dDurationMs: 2124600, id: 1, wpWinPosId: 1 },
    { tStartMs: 0, dDurationMs: 4400, wWinId: 1, segs: [{ utf8: "How" }, { utf8: " much", tOffsetMs: 200 }] },
    { tStartMs: 1870, dDurationMs: 2530, segs: [{ utf8: "\n" }] },
    { tStartMs: 4400, aAppend: 1, segs: [{ utf8: " much" }] },
    { tStartMs: 4400, segs: [{ utf8: ">> And here is the answer." }] },
  ],
});
