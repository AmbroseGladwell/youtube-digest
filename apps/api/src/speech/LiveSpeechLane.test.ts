import test from "node:test";
import assert from "node:assert/strict";
import type { Narration, NarrationRequest, Narrator } from "../audio/Narrator.js";
import { LiveSpeechLane, type LiveSpeechPlay } from "./LiveSpeechLane.js";

interface Pending {
  request: NarrationRequest;
  finish: (outcome: "spoken" | "failed") => void;
}

const heldNarrator = () => {
  const pending: Pending[] = [];
  const asked: string[] = [];
  const narrator: Narrator & { warms: number } = {
    warms: 0,
    async warm() {
      narrator.warms += 1;
    },
    narrate(request) {
      asked.push(request.lines.join(" "));
      return new Promise<Narration>((resolve, reject) => {
        pending.push({
          request,
          finish: (outcome) =>
            outcome === "failed"
              ? reject(new Error("TTS answered 503"))
              : resolve({
                  lineStartsSeconds: request.lines.map((_, index) => index),
                  durationSeconds: request.lines.length,
                  synthesisSeconds: 0.1,
                  audio: Buffer.from(request.lines.join(" ")),
                  trailingSegments: [],
                }),
        });
      });
    },
  };
  return { narrator, pending, asked };
};

const settle = () => new Promise((resolve) => setImmediate(resolve));

const finishNext = async (pending: Pending[], outcome: "spoken" | "failed" = "spoken") => {
  pending.shift()!.finish(outcome);
  await settle();
};

const playOf = (chunks: string[][], signal = new AbortController().signal) => {
  const heard: Array<[number, string | null]> = [];
  const play: LiveSpeechPlay = {
    voice: "af_heart",
    renderVersion: 1,
    chunks,
    signal,
    onChunk: async (index, narration) => {
      heard.push([index, narration === null ? null : narration.audio.toString()]);
    },
  };
  return { play, heard };
};

const laneOf = (narrator: Narrator, slots = 1) => {
  let now = 1_000_000;
  const lane = new LiveSpeechLane({ narrator, slots, clock: () => new Date((now += 1000)) });
  return lane;
};

test("a play's chunks are spoken in order and each one reaches the reader as it is ready", async () => {
  const { narrator, pending } = heldNarrator();
  const lane = laneOf(narrator);
  const { play, heard } = playOf([["One."], ["Two.", "Three."]]);

  const outcome = lane.play(play);
  await finishNext(pending);
  assert.deepEqual(heard, [[0, "One."]]);
  await finishNext(pending);

  assert.deepEqual(heard, [
    [0, "One."],
    [1, "Two. Three."],
  ]);
  assert.equal((await outcome).spoken, 2);
});

test("a new play's first chunk goes ahead of later chunks of a play already going", async () => {
  const { narrator, pending, asked } = heldNarrator();
  const lane = laneOf(narrator);
  void lane.play(playOf([["A1."], ["A2."], ["A3."]]).play);
  await settle();
  void lane.play(playOf([["B1."], ["B2."]]).play);

  await finishNext(pending);
  await finishNext(pending);
  await finishNext(pending);
  await finishNext(pending);

  assert.deepEqual(asked, ["A1.", "B1.", "A2.", "B2.", "A3."]);
});

test("readers take turns chunk by chunk, so a long answer can't hold the slot", async () => {
  const { narrator, pending, asked } = heldNarrator();
  const lane = laneOf(narrator);
  void lane.play(playOf([["A1."], ["A2."], ["A3."], ["A4."]]).play);
  await settle();
  void lane.play(playOf([["B1."], ["B2."], ["B3."]]).play);

  for (let left = 6; left > 0; left -= 1) {
    await finishNext(pending);
  }

  assert.deepEqual(asked, ["A1.", "B1.", "A2.", "B2.", "A3.", "B3.", "A4."]);
});

test("a failed chunk is skipped, never retried, and the play goes on", async () => {
  const { narrator, pending, asked } = heldNarrator();
  const lane = laneOf(narrator);
  const { play, heard } = playOf([["One."], ["Two."], ["Three."]]);

  const outcome = lane.play(play);
  await finishNext(pending);
  await finishNext(pending, "failed");
  await finishNext(pending);

  assert.deepEqual(asked, ["One.", "Two.", "Three."]);
  assert.deepEqual(heard, [
    [0, "One."],
    [1, null],
    [2, "Three."],
  ]);
  assert.deepEqual((({ spoken, skipped, dropped }) => ({ spoken, skipped, dropped }))(await outcome), {
    spoken: 2,
    skipped: 1,
    dropped: 0,
  });
});

test("stopping drops the chunks still waiting, so they never reach the model", async () => {
  const { narrator, pending, asked } = heldNarrator();
  const lane = laneOf(narrator);
  const stop = new AbortController();
  const { play, heard } = playOf([["One."], ["Two."], ["Three."]], stop.signal);

  const outcome = lane.play(play);
  await settle();
  stop.abort();
  await finishNext(pending);

  assert.deepEqual(asked, ["One."]);
  assert.deepEqual(heard, []);
  assert.equal((await outcome).dropped, 2);
});

test("a play stopped while it waits behind another is dropped whole", async () => {
  const { narrator, pending, asked } = heldNarrator();
  const lane = laneOf(narrator);
  void lane.play(playOf([["A1."]]).play);
  await settle();
  const stop = new AbortController();
  const outcome = lane.play(playOf([["B1."], ["B2."]], stop.signal).play);

  stop.abort();
  await finishNext(pending);

  assert.deepEqual(asked, ["A1."]);
  assert.equal((await outcome).dropped, 2);
});

test("only as many chunks are spoken at once as the lane has slots", async () => {
  const { narrator, pending } = heldNarrator();
  const lane = laneOf(narrator, 1);
  void lane.play(playOf([["A1."]]).play);
  void lane.play(playOf([["B1."]]).play);
  await settle();

  assert.equal(pending.length, 1);
});

test("a play's machine time counts the start of a stopped machine once, then only what each chunk adds", async () => {
  const { narrator, pending } = heldNarrator();
  const lane = laneOf(narrator);

  const outcome = lane.play(playOf([["One."], ["Two."]]).play);
  await finishNext(pending);
  await finishNext(pending);
  const { machineSeconds, cold } = await outcome;

  assert.equal(cold, true);
  assert.equal(machineSeconds, 2 + 1 + 15 + 2);
});

test("a warm-up starts the machine only when it isn't already running, and pays for the model loading after it answers", async () => {
  const { narrator } = heldNarrator();
  const lane = laneOf(narrator);

  assert.deepEqual(await lane.warm(), { machineSeconds: 2 + 5 + 15, warmed: true });
  assert.deepEqual(await lane.warm(), { machineSeconds: 0, warmed: false });
  assert.equal(narrator.warms, 1);
});
