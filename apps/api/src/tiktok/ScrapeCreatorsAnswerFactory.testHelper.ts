export const VIDEO_ID = "7700000000000000001";
export const VIDEO_URL = `https://www.tiktok.com/@anewsroom/video/${VIDEO_ID}`;

export const SMALLEST_MEDIA_URL = "https://v16m.tiktokcdn.example/540.mp4";

export const CAPTIONS_VTT = `WEBVTT


00:00:00.000 --> 00:00:01.540
There is now a real chance

00:00:01.541 --> 00:00:04.581
that the talks end without an agreement.

00:00:04.582 --> 00:00:07.021
There are three big issues in debate.
`;

export type AwemeDetail = Record<string, unknown>;

// The shape of ScrapeCreators' /v2/tiktok/video answer, as its docs show it, hand-built.
export const makeAwemeDetail = (overrides: AwemeDetail = {}, videoOverrides: AwemeDetail = {}): AwemeDetail => ({
  aweme_id: VIDEO_ID,
  desc: "Three things to know about the summit #news",
  create_time: 1795303780,
  author: { unique_id: "anewsroom", nickname: "A Newsroom" },
  video: {
    duration: 80_120,
    cover: { url_list: ["https://covers.tiktok.example/cover.jpeg"] },
    play_addr: { url_list: ["https://v16m.tiktokcdn.example/play.mp4"] },
    bit_rate: [
      { gear_name: "adapt_lower_720_2", play_addr: { data_size: 3_151_281, url_list: ["https://v16m.tiktokcdn.example/720.mp4"] } },
      { gear_name: "lowest_540_1", play_addr: { data_size: 1_510_139, url_list: ["https://v16m.tiktokcdn.example/540.mp4"] } },
    ],
    cla_info: {
      caption_infos: [
        { caption_format: "webvtt", language_code: "en", lang: "eng-US", is_auto_generated: true, url: "https://x.example/c" },
      ],
    },
    ...videoOverrides,
  },
  ...overrides,
});

export const makeVendorAnswer = ({
  detail = makeAwemeDetail(),
  transcript,
}: { detail?: AwemeDetail; transcript?: string | null } = {}) => ({
  success: true,
  credits_remaining: 24_000,
  credits_charged: 1,
  aweme_detail: detail,
  ...(transcript === undefined ? {} : { transcript }),
});
