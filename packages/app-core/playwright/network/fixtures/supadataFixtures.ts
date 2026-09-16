import type { Metadata, Transcript } from "@supadata/js";

export const IWFT_VIDEO_ID = "iwftVideoId1";

export function makeMetadataFixture(overrides: Partial<Metadata> = {}): Metadata {
  return {
    platform: "youtube",
    type: "video",
    id: IWFT_VIDEO_ID,
    url: `https://www.youtube.com/watch?v=${IWFT_VIDEO_ID}`,
    title: "The Simulated Video",
    description: "A fixture video used only by the IWFT harness.",
    author: { username: "iwft-channel", displayName: "IWFT Channel", avatarUrl: "", verified: false },
    stats: { views: 1000, likes: 100, comments: 10, shares: null },
    media: {
      type: "video",
      url: "",
      duration: 180,
      width: 1920,
      height: 1080,
      thumbnailUrl: `https://i.ytimg.com/vi/${IWFT_VIDEO_ID}/hqdefault.jpg`,
    },
    tags: [],
    createdAt: new Date().toISOString(),
    additionalData: {},
    ...overrides,
  };
}

export function makeTranscriptFixture(overrides: Partial<Transcript> = {}): Transcript {
  return {
    content: [
      { text: "Hello and welcome to the simulated video.", offset: 0, duration: 3000, lang: "en" },
      { text: "Here is the one claim this video makes.", offset: 3000, duration: 4000, lang: "en" },
      { text: "And here is how you could apply it.", offset: 7000, duration: 3000, lang: "en" },
    ],
    lang: "en",
    availableLangs: ["en"],
    ...overrides,
  };
}
