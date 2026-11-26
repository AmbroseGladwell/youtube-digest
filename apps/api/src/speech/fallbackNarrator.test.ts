import test from "node:test";
import assert from "node:assert/strict";
import type { Narration, NarrationRequest, Narrator, SpeechHost } from "../audio/Narrator.js";
import { createFallbackNarrator, type FallbackReason } from "./fallbackNarrator.js";

const REQUEST: NarrationRequest = { lines: ["One.", "Two."], voice: "af_heart", language: "en-us", renderVersion: 1 };

const narration = (host: SpeechHost): Narration => ({
  lineStartsSeconds: [0, 1],
  durationSeconds: 2,
  synthesisSeconds: 0.1,
  audio: Buffer.from(host),
  trailingSegments: [],
  host,
  fellBack: false,
});

type Behaviour = "speaks" | "silent" | "fails" | "failsAfterALine";

const hostOf = (host: SpeechHost, behaviour: Behaviour) => {
  const asked: string[] = [];
  const narrator: Narrator = {
    async warm() {
      asked.push("warm");
      return host;
    },
    narrate: (request, _id, onLine, signal) =>
      new Promise<Narration>((resolve, reject) => {
        asked.push("narrate");
        signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        if (behaviour === "silent") {
          return;
        }
        if (behaviour === "fails") {
          reject(new Error("TTS answered 502"));
          return;
        }
        void onLine({ lineIndex: 0, startSeconds: 0, segments: [] }).then(() =>
          behaviour === "failsAfterALine" ? reject(new Error("TTS failed partway")) : resolve(narration(host)),
        );
      }),
  };
  return { narrator, asked };
};

const setUp = (modal: Behaviour, { open = true } = {}) => {
  const primary = hostOf("modal", modal);
  const fallback = hostOf("fly", "speaks");
  const fallbacks: FallbackReason[] = [];
  let fire = () => {};
  const narrator = createFallbackNarrator({
    primary: primary.narrator,
    fallback: fallback.narrator,
    firstLineMs: 8000,
    primaryOpen: () => open,
    onFallback: (reason) => fallbacks.push(reason),
    schedule: (action) => {
      fire = action;
      return () => {};
    },
  });
  return { narrator, primary, fallback, fallbacks, timeOut: () => fire() };
};

test("Modal renders when it answers, and Fly is never asked", async () => {
  const { narrator, fallback } = setUp("speaks");

  const done = await narrator.narrate(REQUEST, "r1", async () => {});

  assert.deepEqual([done.host, done.fellBack], ["modal", false]);
  assert.deepEqual(fallback.asked, []);
});

test("no first line from Modal in time goes to Fly", async () => {
  const { narrator, fallbacks, timeOut } = setUp("silent");

  const pending = narrator.narrate(REQUEST, "r1", async () => {});
  timeOut();
  const done = await pending;

  assert.deepEqual([done.host, done.fellBack], ["fly", true]);
  assert.deepEqual(
    fallbacks.map(({ reason }) => reason),
    ["slow"],
  );
});

test("Modal failing before a line goes to Fly, but failing partway doesn't", async () => {
  const before = setUp("fails");
  assert.equal((await before.narrator.narrate(REQUEST, "r1", async () => {})).host, "fly");
  assert.equal(before.fallbacks[0]?.reason, "failed");

  const partway = setUp("failsAfterALine");
  await assert.rejects(
    partway.narrator.narrate(REQUEST, "r2", async () => {}),
    /partway/,
  );
  assert.deepEqual(partway.fallback.asked, []);
});

test("with Modal switched off, everything goes to Fly, warm-ups too", async () => {
  const { narrator, primary, fallback, fallbacks } = setUp("speaks", { open: false });

  assert.equal((await narrator.narrate(REQUEST, "r1", async () => {})).host, "fly");
  assert.equal(await narrator.warm("w1"), "fly");
  assert.deepEqual(primary.asked, []);
  assert.deepEqual(fallback.asked, ["narrate", "warm"]);
  assert.equal(fallbacks[0]?.reason, "closed");
});

test("a reader who stops is not sent to Fly", async () => {
  const { narrator, fallback } = setUp("silent");
  const stop = new AbortController();

  const pending = narrator.narrate(REQUEST, "r1", async () => {}, stop.signal);
  stop.abort();

  await assert.rejects(pending);
  assert.deepEqual(fallback.asked, []);
});
