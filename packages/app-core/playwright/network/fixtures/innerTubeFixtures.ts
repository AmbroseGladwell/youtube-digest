import { VideoId, type StoredTranscript } from "@overview/domain";
import { mapJson3ToSegments, mapPlayerResponseToVideoSource, PlayerResponse } from "@overview/transcripts";

export const IWFT_VIDEO_ID = "iwftVideoId1";

export const IWFT_CAPTION_BASE_URL = `https://www.youtube.com/api/timedtext?v=${IWFT_VIDEO_ID}&lang=en&fmt=srv3`;

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

// What our own server hands back for the fixture video. It fetches through InnerTube too,
// so this is the same player response and captions run through the same mapping, and the
// reader's transcript tab does not depend on which rung fetched them.
// Another video than the fixture's own is the same captions under its own id and title, so
// a queue can be made of several (docs/features/capture-queue.md).
export function makeServiceTranscriptFixture(videoId: string = IWFT_VIDEO_ID, title?: string): StoredTranscript {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const video = mapPlayerResponseToVideoSource(
    PlayerResponse.parse(makePlayerResponseFixture()),
    url,
    PlayerResponse.parse(makeMicroformatFixture()),
  );
  return {
    videoId: VideoId.parse(videoId),
    segments: mapJson3ToSegments(JSON.stringify(makeJson3Fixture())),
    generated: false,
    fetchedAt: "2026-01-01T00:00:00.000Z",
    video: { ...video, id: VideoId.parse(videoId), url, ...(title === undefined ? {} : { title }) },
  };
}
