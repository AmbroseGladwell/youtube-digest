import { describe, expect, it } from "vitest";
import { episodeWordsNotice } from "./episodeWordsNotice.js";

const usage = { usedSeconds: 0, limitSeconds: 5 * 3600, episodes: 0 };

describe("episodeWordsNotice", () => {
  it("says nothing where the words were found, or were already transcribed", () => {
    expect(episodeWordsNotice({ words: "found" }, null)).toEqual({ notice: null, stop: null });
    expect(episodeWordsNotice({ words: "none", transcription: { status: "free", why: "transcribed" } }, null)).toEqual({
      notice: null,
      stop: null,
    });
  });

  it("says it may transcribe where the check couldn't tell", () => {
    expect(episodeWordsNotice({ words: "unknown" }, null).notice).toBe(
      "If there’s no transcript we’ll make one from the audio. Free includes 5 hours a month.",
    );
  });

  it("takes the length from the card where the feed's check gave none, and leaves it out where neither has one", () => {
    const none = { words: "none" as const, transcription: { status: "needed" as const, episodeSeconds: null, usage } };
    expect(episodeWordsNotice(none, 30 * 60_000).notice).toBe(
      "There’s no transcript, so we’ll make one from the audio: about 30 min of your 5 free hours this month.",
    );
    expect(episodeWordsNotice(none, null).notice).toBe(
      "There’s no transcript, so we’ll make one from the audio, from your 5 free hours this month.",
    );
  });

  it("stops at an episode over 4 hours", () => {
    expect(episodeWordsNotice({ words: "none", transcription: { status: "too-long", episodeSeconds: 5 * 3600 } }, null).stop).toMatch(
      /^This episode is over 4 hours/,
    );
  });
});
