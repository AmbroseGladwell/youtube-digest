import test from "node:test";
import assert from "node:assert/strict";
import { parsePodcastTranscript, podcastTranscriptFormat } from "./parsePodcastTranscript.js";

test("a type names its format, whatever its case or parameters, and an unknown one names none", () => {
  assert.equal(podcastTranscriptFormat("text/vtt"), "vtt");
  assert.equal(podcastTranscriptFormat("Application/X-Subrip; charset=utf-8"), "srt");
  assert.equal(podcastTranscriptFormat("application/json"), "json");
  assert.equal(podcastTranscriptFormat("audio/mpeg"), null);
});

test("WebVTT cues keep their own times, with one-digit hours, and lose their speaker tags", () => {
  const vtt = `WEBVTT - 2026-11-12- KSR - Hour 2

0:00:00.110 --> 0:00:02.250
<v Speaker 1>Hey, it's Ryan Lemon from Kentucky Sports Radio. I'm not

0:00:09.530 --> 0:00:10.090
<v Speaker 2>It's equity &amp; more.
`;
  assert.deepEqual(parsePodcastTranscript(vtt, "vtt"), [
    { text: "Hey, it's Ryan Lemon from Kentucky Sports Radio. I'm not", startMs: 110, endMs: 2250 },
    { text: "It's equity & more.", startMs: 9530, endMs: 10090 },
  ]);
});

test("SRT cues join their lines and keep a speaker the host wrote into the text", () => {
  const srt =
    "1\r\n00:00:02,800 --> 00:00:04,640\r\nThis is a global production,.\r\n\r\n2\r\n00:00:05,040 --> 00:00:11,680\r\nGirls. George and Asda.\r\nThat's Asda Price.\r\n\r\n3\r\n00:00:06,339 --> 00:00:15,119\r\nSpeaker 2: Listener discretion is advised.\r\n";
  assert.deepEqual(parsePodcastTranscript(srt, "srt"), [
    { text: "This is a global production,.", startMs: 2800, endMs: 4640 },
    { text: "Girls. George and Asda. That's Asda Price.", startMs: 5040, endMs: 11680 },
    { text: "Speaker 2: Listener discretion is advised.", startMs: 6339, endMs: 15119 },
  ]);
});

test("timed words are joined into lines at a sentence's end, a pause, or a change of speaker", () => {
  const json = JSON.stringify({
    version: "1.0.0",
    segments: [
      { startTime: 2.8, endTime: 3.04, body: "This" },
      { startTime: 3.04, endTime: 3.32, body: "is" },
      { startTime: 3.32, endTime: 4.64, body: "global." },
      { startTime: 5.04, endTime: 5.84, body: "Girls" },
      { startTime: 9.0, endTime: 9.5, body: "George" },
      { startTime: 9.5, endTime: 9.9, body: "said", speaker: "B" },
    ],
  });
  assert.deepEqual(parsePodcastTranscript(json, "json"), [
    { text: "This is global.", startMs: 2800, endMs: 4640 },
    { text: "Girls", startMs: 5040, endMs: 5840 },
    { text: "George", startMs: 9000, endMs: 9500 },
    { text: "said", startMs: 9500, endMs: 9900 },
  ]);
  assert.deepEqual(parsePodcastTranscript("{not json", "json"), []);
});

test("an HTML transcript is timed where each paragraph starts, and ends there too", () => {
  const html = `<cite>Speaker A</cite>
<time>00:00:02</time>
<p>This is a global production,.</p>
<cite>Speaker B</cite>
<time>00:01:05</time>
<p>Girls.

George and Asda.</p>`;
  assert.deepEqual(parsePodcastTranscript(html, "html"), [
    { text: "This is a global production,.", startMs: 2000, endMs: 2000 },
    { text: "Girls. George and Asda.", startMs: 65000, endMs: 65000 },
  ]);
});

test("plain text counts only when it carries times", () => {
  const timed = "00:00:00\nSpeaker 1: Hey, it's Ryan.\n\n00:00:09\nSpeaker 2: It's equity.\n";
  assert.deepEqual(parsePodcastTranscript(timed, "text"), [
    { text: "Speaker 1: Hey, it's Ryan.", startMs: 0, endMs: 0 },
    { text: "Speaker 2: It's equity.", startMs: 9000, endMs: 9000 },
  ]);
  assert.deepEqual(parsePodcastTranscript("Speaker 1: Hey, it's Ryan.\n\nSpeaker 2: It's equity.", "text"), []);
});

const cueFile = (cues: [number, number, string][]) =>
  "WEBVTT\n\n" +
  cues
    .map(
      ([start, end, text]) =>
        `00:${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}.000 --> 00:${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}.000\n${text}`,
    )
    .join("\n\n");

test("a few cues whose times run backwards, where an ad was spliced in, are dropped and the rest kept", () => {
  const steady = Array.from({ length: 100 }, (_, index): [number, number, string] => [index * 2, index * 2 + 2, `line ${index}`]);
  const spliced: [number, number, string][] = [
    ...steady.slice(0, 60),
    [122, 114, "ends before it starts"],
    [115, 117, "back in time"],
    ...steady.slice(61),
  ];
  const segments = parsePodcastTranscript(cueFile(spliced), "vtt");
  assert.equal(segments.length, 99);
  assert.ok(segments.every((segment, index) => index === 0 || segment.startMs >= segments[index - 1]!.startMs));
  assert.ok(!segments.some((segment) => segment.text === "back in time" || segment.text === "ends before it starts"));
});

test("a file with many cues out of order isn't trusted at all", () => {
  const shuffled = Array.from({ length: 50 }, (_, index): [number, number, string] => [
    index % 2 === 0 ? index * 2 : 0,
    index * 2 + 1,
    `line ${index}`,
  ]);
  assert.deepEqual(parsePodcastTranscript(cueFile(shuffled), "vtt"), []);
});
