import { describe, expect, it } from "vitest";
import { pastedLinkState } from "./pastedLinkState.js";
import type { PodcastEpisode, SocialPost, TikTokVideo, TranscriptionOffer } from "@overview/domain";
import type { SocialLink, SocialStop } from "../useSocialLink.js";
import type { TikTokLink } from "../useTikTokLink.js";

const episode = { title: "An episode" } as PodcastEpisode;
const video = { id: "7700000000000000001", durationSeconds: 40 } as TikTokVideo;
const noPodcast = { link: { status: "none" as const }, platformLink: false };
const uncaptioned = (transcription: TranscriptionOffer | null, stop: "no-captions" | null = null): TikTokLink => ({
  status: "found",
  video,
  words: null,
  transcription,
  stop,
});

describe("pastedLinkState", () => {
  it("shows a Spotify or Apple link as an episode from the moment it's read", () => {
    expect(pastedLinkState({ status: "none" }, { link: { status: "reading" }, platformLink: true })).toEqual({
      podcastShown: true,
      tiktokShown: false,
      socialShown: false,
      reading: true,
      generateOffered: true,
      episodeAction: null,
    });
  });

  it("keeps a page that may be an episode as an article until our server finds the episode there", () => {
    const pending = pastedLinkState({ status: "reading" }, { link: { status: "reading" }, platformLink: false });
    expect(pending.podcastShown).toBe(false);
    expect(pending.reading).toBe(true);
    const found = pastedLinkState(
      { status: "reading" },
      { link: { status: "found", episode, words: { state: "found" } }, platformLink: false },
    );
    expect(found.podcastShown).toBe(true);
    expect(found.reading).toBe(false);
  });

  it("offers nothing to make for an episode that failed or is already held", () => {
    expect(
      pastedLinkState({ status: "none" }, { link: { status: "failed", reason: "not-found", showName: null }, platformLink: true })
        .generateOffered,
    ).toBe(false);
  });

  it("waits while the episode's words are checked for, and offers nothing to make when it can't be transcribed", () => {
    const usage = { usedSeconds: 4 * 3600, limitSeconds: 5 * 3600, episodes: 2 };
    const checking = pastedLinkState(
      { status: "none" },
      { link: { status: "found", episode, words: { state: "checking" } }, platformLink: true },
    );
    const stopped = pastedLinkState(
      { status: "none" },
      {
        link: { status: "found", episode, words: { state: "none", transcription: { status: "not-enough", episodeSeconds: 6960, usage } } },
        platformLink: true,
      },
    );
    const transcribes = pastedLinkState(
      { status: "none" },
      {
        link: { status: "found", episode, words: { state: "none", transcription: { status: "needed", episodeSeconds: 1800, usage } } },
        platformLink: true,
      },
    );
    expect(checking).toMatchObject({ reading: true, generateOffered: true, episodeAction: { kind: "waiting" } });
    expect(stopped).toMatchObject({ reading: false, generateOffered: false, episodeAction: { kind: "stop" } });
    expect(transcribes).toMatchObject({ reading: false, generateOffered: true, episodeAction: { kind: "transcribe" } });
  });

  it("offers to transcribe a TikTok with no captions, as an episode, and stops where it can't be", () => {
    const usage = { usedSeconds: 0, limitSeconds: 18_000, episodes: 0 };
    const transcribes = pastedLinkState({ status: "none" }, noPodcast, uncaptioned({ status: "needed", episodeSeconds: 40, usage }));
    const outOfHours = pastedLinkState({ status: "none" }, noPodcast, uncaptioned({ status: "not-enough", episodeSeconds: 40, usage }));
    const noCaptions = pastedLinkState({ status: "none" }, noPodcast, uncaptioned(null, "no-captions"));

    expect(transcribes).toMatchObject({ tiktokShown: true, generateOffered: true, episodeAction: { kind: "transcribe" } });
    expect(outOfHours).toMatchObject({ generateOffered: false, episodeAction: { kind: "stop" } });
    expect(noCaptions).toMatchObject({ generateOffered: false, episodeAction: null });
  });

  it("offers to transcribe an Instagram video with no words, never a photo post, and stops a post with too little written", () => {
    const usage = { usedSeconds: 0, limitSeconds: 18_000, episodes: 0 };
    const reel = { platform: "instagram", media: "video", durationSeconds: 40 } as SocialPost;
    const found = (post: SocialPost, transcription: TranscriptionOffer | null, stop: SocialStop | null = null): SocialLink => ({
      status: "found",
      post,
      words: null,
      transcription,
      stop,
    });
    const transcribes = pastedLinkState(
      { status: "none" },
      noPodcast,
      undefined,
      found(reel, { status: "needed", episodeSeconds: 40, usage }),
    );
    const photo = pastedLinkState({ status: "none" }, noPodcast, undefined, found({ ...reel, media: "photo" }, null));
    const tooShort = pastedLinkState({ status: "none" }, noPodcast, undefined, found({ ...reel, media: "text" }, null, "too-few-words"));

    expect(transcribes).toMatchObject({
      socialShown: true,
      tiktokShown: false,
      generateOffered: true,
      episodeAction: { kind: "transcribe" },
    });
    expect(photo).toMatchObject({ socialShown: true, generateOffered: true, episodeAction: null });
    expect(tooShort).toMatchObject({ generateOffered: false, episodeAction: null });
  });
});
