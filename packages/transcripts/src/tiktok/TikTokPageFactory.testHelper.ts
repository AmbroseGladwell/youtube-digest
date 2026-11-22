export const VIDEO_ID = "7700000000000000001";
export const CAPTIONS_URL = "https://captions.tiktok.example/track.vtt";

export const CAPTIONS_VTT = `WEBVTT


00:00:00.000 --> 00:00:01.540
There is now a real chance

00:00:01.541 --> 00:00:04.581
that the talks end without an agreement.

00:00:04.582 --> 00:00:07.021
There are three big issues in debate.
`;

export type TikTokItem = Record<string, unknown>;

export const makeTikTokItem = (overrides: TikTokItem = {}, videoOverrides: TikTokItem = {}): TikTokItem => ({
  id: VIDEO_ID,
  desc: "Three things to know about the summit #news",
  createTime: "1795303780",
  author: { uniqueId: "anewsroom", nickname: "A Newsroom", id: "1" },
  video: {
    duration: 80,
    cover: "https://covers.tiktok.example/cover.jpeg",
    subtitleInfos: [{ LanguageCodeName: "eng-US", Source: "ASR", Format: "webvtt", Url: CAPTIONS_URL, Size: "300" }],
    ...videoOverrides,
  },
  ...overrides,
});

export const makeTikTokPage = (detail: Record<string, unknown> = { statusCode: 0, itemInfo: { itemStruct: makeTikTokItem() } }): string =>
  `<!DOCTYPE html><html><head><title>TikTok</title></head><body><script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify(
    { __DEFAULT_SCOPE__: { "webapp.app-context": {}, "webapp.video-detail": detail } },
  )}</script></body></html>`;

export const pageWithItem = (item: TikTokItem): string => makeTikTokPage({ statusCode: 0, itemInfo: { itemStruct: item } });
