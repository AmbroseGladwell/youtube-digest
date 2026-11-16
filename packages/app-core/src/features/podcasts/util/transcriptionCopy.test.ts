import { describe, expect, it } from "vitest";
import { transcriptionCopy } from "./transcriptionCopy.js";

const HOUR = 3600;
const usage = (usedSeconds: number, limitHours = 5) => ({ usedSeconds, limitSeconds: limitHours * HOUR, episodes: 1 });
const EPISODE = HOUR + 56 * 60;

describe("transcriptionCopy", () => {
  it("says on the card what the episode needs and what choosing it uses (305c)", () => {
    expect(transcriptionCopy.needs(EPISODE)).toBe("Needs transcribing · about 2 min");
    expect(transcriptionCopy.needs(null)).toBe("Needs transcribing · a few minutes");
    expect(transcriptionCopy.uses(EPISODE, usage(0))).toBe("Uses 1 hr 56 min of your 5 hr transcribing left, and one overview");
    expect(transcriptionCopy.uses(EPISODE, usage(HOUR + 4 * 60))).toBe(
      "Uses 1 hr 56 min of your 3 hr 56 min transcribing left, and one overview",
    );
  });

  it("stops in the action's place, by plan, when there isn't enough left (305h)", () => {
    const free = transcriptionCopy.stop(
      { status: "not-enough", episodeSeconds: EPISODE, usage: usage(3 * HOUR + 50 * 60) },
      "free",
      "2026-12-01",
    );
    expect(free.heading).toBe("You don’t have enough transcribing left for this one");
    expect(free.body).toBe(
      "It’s 1 hr 56 min, and you have 1 hr 10 min left this month. You’ll have 5 hours again on 1 December. BYO Plus transcribes 15 hours a month, Plus 30. No overview was used.",
    );
    expect(free.route).toBe("plans");

    const plus = transcriptionCopy.stop(
      { status: "not-enough", episodeSeconds: EPISODE, usage: usage(30 * HOUR, 30) },
      "plus",
      "2026-12-01",
    );
    expect(plus.heading).toBe("You’ve used this month’s 30 hours of transcribing");
    expect(plus.body).toBe(
      "You’ll have 30 hours again on 1 December. 30 is the most any plan gives, so there’s no upgrade for this. No overview was used.",
    );
    expect(plus.route).toBeNull();
    expect(transcriptionCopy.stop({ status: "not-enough", episodeSeconds: EPISODE, usage: usage(0, 15) }, "byo-plus", null).route).toBe(
      "plus",
    );
  });

  it("says an episode over four hours can't be transcribed on any plan (305j)", () => {
    const stop = transcriptionCopy.stop({ status: "too-long", episodeSeconds: 4 * HOUR + 38 * 60 }, "plus", "2026-12-01");
    expect(stop.heading).toBe("Episodes over 4 hours can’t be transcribed");
    expect(stop.body).toContain("This one is 4 hr 38 min.");
  });

  it("names each failure, says nothing was counted, and offers Try again only where it may help (305k)", () => {
    expect(transcriptionCopy.failed("no-transcriber")).toMatchObject({ heading: "Transcribing couldn’t start", retry: true });
    expect(transcriptionCopy.failed("failed")).toMatchObject({ heading: "Transcribing stopped partway", retry: true });
    expect(transcriptionCopy.failed("audio-unreachable")).toMatchObject({ heading: "We couldn’t get the episode’s audio", retry: false });
    expect(transcriptionCopy.failed("failed").body).toContain("Nothing was counted: no transcribing time and no overview.");
  });
});
