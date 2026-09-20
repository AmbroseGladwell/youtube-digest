import { IWFT_VIDEO_ID } from "./supadataFixtures.js";

export const IWFT_CAPTION_BASE_URL = `https://www.youtube.com/api/timedtext?v=${IWFT_VIDEO_ID}&lang=en&fmt=srv3`;

// The same three cues the Supadata fixture carries, so what the reader's transcript tab
// makes of them does not depend on which rung fetched them.
export function makePlayerResponseFixture(overrides: Record<string, unknown> = {}) {
  return {
    playabilityStatus: { status: "OK" },
    videoDetails: {
      videoId: IWFT_VIDEO_ID,
      title: "The Simulated Video",
      author: "IWFT Channel",
      shortDescription: "A fixture video used only by the IWFT harness.",
      lengthSeconds: "180",
      isLiveContent: false,
      thumbnail: {
        thumbnails: [
          { url: `https://i.ytimg.com/vi/${IWFT_VIDEO_ID}/hqdefault.jpg`, width: 480, height: 360 },
        ],
      },
    },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [{ baseUrl: IWFT_CAPTION_BASE_URL, languageCode: "en", vssId: ".en" }],
      },
    },
    ...overrides,
  };
}

// The WEB client carries no caption tracks and is asked for one thing only.
export function makeMicroformatFixture(publishDate = "2026-01-01T00:00:00-00:00") {
  return {
    playabilityStatus: { status: "UNPLAYABLE" },
    microformat: { playerMicroformatRenderer: { publishDate, uploadDate: publishDate } },
  };
}

export function makeJson3Fixture() {
  return {
    events: [
      { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: "Hello and welcome to the simulated video." }] },
      { tStartMs: 3000, dDurationMs: 4000, segs: [{ utf8: "Here is the one claim this video makes." }] },
      { tStartMs: 7000, dDurationMs: 3000, segs: [{ utf8: "And here is how you could apply it." }] },
    ],
  };
}
