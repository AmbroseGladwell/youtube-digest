export const SHORTCODE = "DAbCdEfGh12";
export const REEL_LINK = `https://www.instagram.com/reel/${SHORTCODE}/?igsh=abc`;
export const INSTAGRAM_VIDEO_URL = "https://scontent.cdninstagram.example/reel.mp4?oe=6B07CFFA";
export const FACEBOOK_VIDEO_ID = "1535600000000001";
export const FACEBOOK_LINK = `https://www.facebook.com/reel/${FACEBOOK_VIDEO_ID}`;
export const FACEBOOK_SD_URL = "https://video.fbcdn.example/sd.mp4?oe=6AFBD359";
export const LONG_DESCRIPTION = `Five ways to keep basil alive on a windowsill.\n\n${"Water from below, never over the leaves. ".repeat(40)}`;

export const CAPTIONS_SRT = `1
00:00:00,000 --> 00:00:02,561
Pinch the top leaves first

2
00:00:02,562 --> 00:00:05,100
so the plant grows outwards.
`;

export type Fields = Record<string, unknown>;

// The shape of ScrapeCreators' /v1/instagram/post answer as read live on 23 Nov 2026, hand-built, comments included.
export const makeInstagramAnswer = (media: Fields = {}): Fields => ({
  success: true,
  credits_remaining: 24_000,
  credits_charged: 1,
  data: {
    xdt_shortcode_media: {
      __typename: "XDTGraphVideo",
      id: "3597000000000000001",
      shortcode: SHORTCODE,
      thumbnail_src: "https://scontent.cdninstagram.example/thumb.jpg",
      display_url: "https://scontent.cdninstagram.example/display.jpg",
      video_url: INSTAGRAM_VIDEO_URL,
      has_audio: true,
      product_type: "clips",
      video_duration: 59.099,
      is_video: true,
      owner: { id: "295400001", username: "windowsillgarden", full_name: "Windowsill Garden", is_verified: false },
      edge_media_to_caption: { edges: [{ node: { text: LONG_DESCRIPTION } }] },
      taken_at_timestamp: 1795303780,
      edge_media_to_parent_comment: { edges: [{ node: { text: "A commenter's own words", owner: { username: "commenter" } } }] },
      ...media,
    },
  },
});

export const INSTAGRAM_PHOTO = {
  __typename: "XDTGraphImage",
  is_video: false,
  video_url: undefined,
  video_duration: undefined,
};

// The shape of ScrapeCreators' /v1/facebook/post answer as read live on 23 Nov 2026, hand-built.
export const makeFacebookAnswer = (fields: Fields = {}, video: Fields | null = {}): Fields => ({
  success: true,
  credits_remaining: 24_000,
  credits_charged: 1,
  post_id: "25118300000000001",
  description: LONG_DESCRIPTION,
  creation_time: "2026-11-18T06:30:18.000Z",
  url: FACEBOOK_LINK,
  image_url: null,
  video:
    video === null
      ? null
      : {
          id: FACEBOOK_VIDEO_ID,
          sd_url: FACEBOOK_SD_URL,
          hd_url: "https://video.fbcdn.example/hd.mp4",
          height: 1920,
          width: 1080,
          length_in_second: 23.36,
          thumbnail: "https://scontent.fbcdn.example/thumb.jpg",
          ...video,
        },
  author: {
    id: "100000000000001",
    name: "Windowsill Garden",
    handle: "windowsill.garden",
    url: "https://www.facebook.com/windowsill.garden",
  },
  ...fields,
});
