import { describe, expect, it } from "vitest";
import { OverviewId, PlayerState, type NoteLine } from "@overview/domain";
import type { PlayerSnapshot, PlayerStatus } from "../types/PlayerSnapshot.js";
import { playerBarView, sectionHeadingAt } from "./playerBarView.js";

const line = (section: string, text: string, heading = false): NoteLine => ({ section, heading, bullet: false, text });

const LINES = [
  line("Summary", "Premise", true),
  line("Summary", "Three grids are costing reactors back in."),
  line("Key points", "Key points", true),
  line("Key points", "Capacity prices drive the reversal."),
];

const snapshot = (patch: Partial<PlayerSnapshot> = {}): PlayerSnapshot => ({
  track: {
    overviewId: OverviewId.parse("0b8a3b8e-6f7a-4a52-9d2f-1f3c2b8d9e01"),
    title: "The Quiet Return of Nuclear Baseload",
    channel: "Practical Engineering",
    artworkUrl: null,
    opening: "The Quiet Return of Nuclear Baseload, from Practical Engineering.",
    lines: LINES,
  },
  status: "ready",
  source: "audio",
  pacerReason: null,
  availability: "ready",
  preparing: null,
  timings: { lineStarts: [0, 60, 120, 180], durationSeconds: 364 },
  rate: 1,
  voice: "af_heart",
  narratedVoice: "af_heart",
  ...patch,
});

const view = (patch: Partial<PlayerSnapshot>, time = 0, read = false) => playerBarView(snapshot(patch), time, { read });

describe("playerBarView", () => {
  it("1a: before the first press, says what you'll get, with seeking off", () => {
    const bar = view({});
    expect(bar.label).toMatchObject({ lead: "Narrated", rest: "Heart voice" });
    expect(bar.clock.inline).toBe("6:04");
    expect(bar).toMatchObject({ skipEnabled: false, seekable: false });
  });

  it("1b: an old note says its audio is made on first play, with an estimated length", () => {
    const bar = view({ availability: "onFirstPlay" });
    expect(bar.label).toMatchObject({ lead: "Audio is made on first play", rest: "about 20 s" });
    expect(bar.clock.inline).toBe("~6 min");
  });

  it("44a and 44b: a render nobody here asked for borrows 1c's label and sweep, but offers Play", () => {
    const bar = view({ availability: "preparing", preparing: { step: "rendering", long: false } });
    expect(bar.label).toMatchObject({ lead: "Preparing audio", rest: "Rendering" });
    expect(bar.main).toEqual({ kind: "play", label: "Play", disabled: false });
    expect(bar.track.fill).toBe("sweep");
    expect(bar.clock.inline).toBe("~6 min");
    expect(bar).toMatchObject({ skipEnabled: false, seekable: false, actions: [] });

    expect(view({ availability: "preparing", preparing: { step: "queued", long: false } }).label.rest).toBe("Queued");
  });

  it("1c and 1d: preparing names the server's step, and after a long wait offers the pacer", () => {
    const quick = view({ status: "preparing", preparing: { step: "rendering", long: false } });
    expect(quick.label).toMatchObject({ lead: "Preparing audio", rest: "Rendering" });
    expect(quick.main).toMatchObject({ kind: "cancel", label: "Cancel preparing audio" });
    expect(quick.track.fill).toBe("sweep");

    const long = view({ status: "preparing", preparing: { step: "rendering", long: true } });
    expect(long.label).toMatchObject({ lead: "Still preparing", rest: "taking longer than usual" });
    expect(long.actions).toEqual(["readAlongMeanwhile"]);
  });

  it("1e and 1f: playing names the section; paused keeps it named; both show elapsed and time left", () => {
    const playing = view({ status: "playing" }, 94);
    expect(playing.label.lead).toBe("Now playing · Premise");
    expect(playing.clock).toEqual({ inline: "1:34 · −4:30", start: "1:34", end: "−4:30" });
    expect(playing.main.kind).toBe("pause");

    const paused = view({ status: "paused" }, 130);
    expect(paused.label).toMatchObject({ lead: "Paused", rest: "Key points" });
  });

  it("names the video while its opening is narrated, before the first line starts", () => {
    const opening = { timings: { lineStarts: [4, 60, 120, 180], durationSeconds: 364 } };

    expect(view({ ...opening, status: "playing" }, 2).label.lead).toBe(
      "Now playing · The Quiet Return of Nuclear Baseload",
    );
    expect(view({ ...opening, status: "playing" }, 5).label.lead).toBe("Now playing · Premise");
  });

  it("1g: buffering holds the clock and still offers to pause", () => {
    const bar = view({ status: "buffering" }, 112);
    expect(bar.label).toMatchObject({ lead: "Buffering", rest: "Premise" });
    expect(bar.main).toMatchObject({ kind: "buffering", label: "Pause, buffering" });
    expect(bar.clock.inline).toBe("1:52 · −4:12");
  });

  it("1h: finished offers to play again and to mark read, unless it already is", () => {
    expect(view({ status: "ended" }, 364)).toMatchObject({
      label: { lead: "Finished" },
      main: { kind: "replay", label: "Play again" },
      actions: ["markRead"],
    });
    expect(view({ status: "ended" }, 364, true).actions).toEqual([]);
  });

  it("1i and 1j: failed is in warning ink with a way out; busy says to wait and read along", () => {
    expect(view({ status: "failed" })).toMatchObject({
      label: { lead: "Couldn't prepare the audio", tone: "warning" },
      main: { disabled: true },
      actions: ["tryAgain", "readAlongInstead"],
    });
    expect(view({ status: "busy" })).toMatchObject({
      label: { lead: "A few notes are already being prepared", rest: "try again when one finishes" },
      actions: ["readAlong"],
    });
  });

  it("1k and 1l: the pacer is tagged, estimated with a ~, on a stone track, and says why", () => {
    const pacerTimings = { lineStarts: [0, 20, 40, 60], durationSeconds: 340 };
    const signedOut = view({ source: "pacer", pacerReason: "signedOut", status: "playing", timings: pacerTimings }, 40);
    expect(signedOut.label).toMatchObject({ lead: "Read-along · no audio", rest: "Key points", pacerTag: true });
    expect(signedOut.clock.inline).toBe("~0:40 · ~5 min left");
    expect(signedOut.track).toMatchObject({ tone: "stone", thumb: false });
    expect(signedOut.actions).toEqual(["signIn"]);

    const unavailable = view({ source: "pacer", pacerReason: "unavailable", status: "playing", timings: pacerTimings }, 40);
    expect(unavailable.label.rest).toBe("narration is unavailable right now");
    expect(unavailable.actions).toEqual([]);
  });

  it("the rate is written as the design writes it", () => {
    expect(view({ rate: 1.25 }).rateLabel).toBe("1.25×");
  });
});

describe("43i and 43j: the voice", () => {
  it("names the voice as a way to the voice setting before the first press", () => {
    expect(view({}).label).toMatchObject({ rest: "Heart voice", voiceLink: true });
    expect(view({ availability: "checking", narratedVoice: null, voice: "bf_emma" }).label).toMatchObject({
      lead: "Listen",
      rest: "Emma voice",
      voiceLink: true,
    });
  });

  it("a note narrated in an older voice names that voice and offers the chosen one", () => {
    const bar = view({ voice: "bf_emma", narratedVoice: "af_heart" });
    expect(bar.label).toMatchObject({ lead: "Narrated", rest: "Heart voice" });
    expect(bar.reRecord).toBe("Re-record in Emma");
  });

  it("the offer shows while stopped or paused, not while playing", () => {
    const older = { voice: "bm_george" as const, narratedVoice: "af_heart" as const };
    expect(view({ ...older, status: "paused" }, 30).reRecord).toBe("Re-record in George");
    expect(view({ ...older, status: "ended" }, 364).reRecord).toBe("Re-record in George");
    expect(view({ ...older, status: "playing" }, 30).reRecord).toBeNull();
  });

  it("a note already in the chosen voice offers nothing", () => {
    expect(view({ status: "paused" }, 30).reRecord).toBeNull();
    expect(view({}).reRecord).toBeNull();
  });
});

describe("sectionHeadingAt", () => {
  it("is the heading printed over the line, which for the summary is Premise", () => {
    expect(sectionHeadingAt(LINES, 1)).toBe("Premise");
    expect(sectionHeadingAt(LINES, 3)).toBe("Key points");
  });
});

// A press says which state it was made in, so the catalogue has to know every one of them:
// the record fails to compile if a status is added here, and the test if one is added there.
const EVERY_STATUS: Record<PlayerStatus, true> = {
  ready: true,
  preparing: true,
  playing: true,
  paused: true,
  buffering: true,
  ended: true,
  failed: true,
  busy: true,
};

describe("the states a press can be counted under", () => {
  it("are every state the player has, so reader.playerBar.mainPressed can always say which", () => {
    expect([...PlayerState.options].sort()).toEqual(Object.keys(EVERY_STATUS).sort());
  });
});
