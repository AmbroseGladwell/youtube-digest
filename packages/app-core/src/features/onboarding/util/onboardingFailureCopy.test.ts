import { describe, expect, it } from "vitest";
import { onboardingFailureCopy } from "./onboardingFailureCopy.js";

const LINK = "https://fieldnotes.com/essays/the-case-for-boredom";

describe("onboardingFailureCopy", () => {
  it("never says nothing counted, since a trial read always counts", () => {
    const reasons = ["nothing-readable", "paywalled", "blocked", "not-found", "no-answer", "unfinished"] as const;
    for (const reason of reasons) {
      const copy = onboardingFailureCopy({ kind: "read", failure: { status: "failed", reason } }, LINK, "computer");
      expect(copy.body).not.toMatch(/counted/i);
    }
  });

  it("names a site that turned us away, and tells a computer of the extension only for afterwards", () => {
    const blocked = { kind: "read" as const, failure: { status: "failed" as const, reason: "blocked" as const, siteName: "Field Notes" } };
    expect(onboardingFailureCopy(blocked, LINK, "computer")).toMatchObject({
      title: "Field Notes didn't let us in",
      extension: expect.stringMatching(/after your first overview/),
    });
    expect(onboardingFailureCopy(blocked, LINK, "phone").extension).toBeNull();
  });

  it("offers Try again only where waiting might help", () => {
    const noAnswer = onboardingFailureCopy({ kind: "read", failure: { status: "failed", reason: "no-answer" } }, LINK, "computer");
    const paywalled = onboardingFailureCopy({ kind: "read", failure: { status: "failed", reason: "paywalled" } }, LINK, "computer");
    const unfinished = onboardingFailureCopy({ kind: "read", failure: { status: "failed", reason: "unfinished" } }, LINK, "computer");
    expect(unfinished).toMatchObject({ title: "We couldn't finish reading that page", tryAgain: true });
    expect(noAnswer).toMatchObject({ title: "fieldnotes.com didn't respond", tryAgain: true });
    expect(paywalled).toMatchObject({ title: "That article is behind a paywall", tryAgain: false });
  });

  it("calls a page with nothing readable at a site's root a front page", () => {
    const failure = { kind: "read" as const, failure: { status: "failed" as const, reason: "nothing-readable" as const } };
    expect(onboardingFailureCopy(failure, "https://fieldnotes.com/", "computer").title).toBe("That looks like a front page");
    expect(onboardingFailureCopy(failure, LINK, "computer").title).toBe("We couldn't read that page");
  });

  it("tells a device or network out of reads that every link counts, and when it can read again", () => {
    expect(onboardingFailureCopy({ kind: "trialReads" }, LINK, "computer")).toMatchObject({
      title: "You've tried 5 links on this device",
      body: expect.stringMatching(/tomorrow/),
    });
    expect(onboardingFailureCopy({ kind: "trialReadsAddress" }, LINK, "computer")).toMatchObject({
      body: expect.stringMatching(/15 links a day.*tomorrow/),
    });
  });

  it("says a video it couldn't find is gone, and offers to try again only when YouTube didn't answer", () => {
    expect(onboardingFailureCopy({ kind: "videoRead", reason: "not-found" }, LINK, "computer")).toMatchObject({
      title: "We couldn't find that video",
      tryAgain: false,
    });
    expect(onboardingFailureCopy({ kind: "videoRead", reason: "unavailable" }, LINK, "computer").tryAgain).toBe(true);
  });
});

describe("onboardingFailureCopy for an episode", () => {
  const SPOTIFY = "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk";

  it("leaves the free overview to the foot rather than saying no overview was used", () => {
    const copy = onboardingFailureCopy({ kind: "podcastRead", reason: "not-found", showName: "The Diary Of A CEO" }, SPOTIFY, "computer");
    expect(copy.title).toBe("This episode isn’t in The Diary Of A CEO’s public feed");
    expect(copy.body).not.toContain("No overview was used");
  });

  it("offers to try again only when our server didn't hear back", () => {
    expect(onboardingFailureCopy({ kind: "podcastRead", reason: "no-answer", showName: null }, SPOTIFY, "computer").tryAgain).toBe(true);
    expect(onboardingFailureCopy({ kind: "podcastRead", reason: "no-public-feed", showName: null }, SPOTIFY, "computer").tryAgain).toBe(
      false,
    );
  });

  it("says an episode with no words is common, where our server can't transcribe it", () => {
    const copy = onboardingFailureCopy({ kind: "podcastNoTranscript" }, SPOTIFY, "phone");
    expect(copy.body).toContain("Many episodes don’t have one yet.");
    expect(copy.transcribe).toBeNull();
  });

  it("offers to transcribe an episode with no words where our server can, and to try again only where that may help", () => {
    const ask = onboardingFailureCopy({ kind: "podcastNeedsTranscribing", episodeSeconds: 6960 }, SPOTIFY, "phone");
    expect(ask.title).toBe("This episode needs transcribing");
    expect(ask.body).toBe("We couldn’t find a transcript for this episode, so we’ll make one from its audio. It takes about 2 minutes.");
    expect(ask.transcribe).toBe("Transcribe and create");
    expect(onboardingFailureCopy({ kind: "transcriptionFailed", reason: "no-transcriber" }, SPOTIFY, "phone").transcribe).toBe("Try again");
    expect(onboardingFailureCopy({ kind: "transcriptionFailed", reason: "audio-unreachable" }, SPOTIFY, "phone").transcribe).toBeNull();
  });

  it("says why a TikTok couldn't be read, offering Try again only where waiting might help", () => {
    const tiktok = "https://www.tiktok.com/@kitchenwithada/video/7301234567890123456";
    expect(onboardingFailureCopy({ kind: "tiktokRead", reason: "not-a-video" }, tiktok, "computer")).toMatchObject({
      title: "That isn’t a TikTok video",
      tryAgain: false,
    });
    expect(onboardingFailureCopy({ kind: "tiktokRead", reason: "unavailable" }, tiktok, "computer").tryAgain).toBe(false);
    expect(onboardingFailureCopy({ kind: "tiktokRead", reason: "blocked" }, tiktok, "computer")).toMatchObject({
      title: "We couldn't reach TikTok just now",
      tryAgain: true,
    });
    expect(onboardingFailureCopy({ kind: "tiktokNoCaptions" }, tiktok, "computer").title).toBe("This TikTok has no captions");
  });
});
