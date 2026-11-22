import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { TranscriptBlock } from "./TranscriptBlock.js";
import { transcriptQueryOf } from "./transcriptQueryOf.js";
import { marksIn, SNIPPET_MAX_CHARS, transcriptSnippet } from "./transcriptSnippet.js";

const block = (startMs: number, text: string): TranscriptBlock => ({ text, startMs, endMs: startMs + 20_000, speakerChange: false });

const marked = (text: string, marks: Array<{ start: number; end: number }>) => marks.map(({ start, end }) => text.slice(start, end));

describe("marksIn", () => {
  it("marks each word and its endings, whatever the case", () => {
    const text = "Running helps. A runner runs; Sleep and sleeping too.";
    assert.deepEqual(marked(text, marksIn(text, transcriptQueryOf("running sleep"))), ["Running", "runner", "Sleep", "sleeping"]);
  });

  it("marks a phrase across punctuation as one run, and not its words apart", () => {
    const text = "Dim the lights. Then dim, the lights again; the lights stay.";
    assert.deepEqual(marked(text, marksIn(text, transcriptQueryOf('"dim the lights"'))), ["Dim the lights", "dim, the lights"]);
  });

  it("never marks a number inside a longer one", () => {
    const text = "Take 300 mg, not 3000 mg.";
    assert.deepEqual(marked(text, marksIn(text, transcriptQueryOf("300"))), ["300"]);
  });

  it("merges marks that overlap", () => {
    const text = "magnesium glycinate";
    assert.deepEqual(marksIn(text, transcriptQueryOf('"magnesium glycinate" magnesium')), [{ start: 0, end: 19 }]);
  });
});

describe("transcriptSnippet", () => {
  const minute = { startMs: 60_000, endMs: 120_000 };

  it("takes the paragraph in the minute that holds the most of the words, at that paragraph's time", () => {
    const blocks = [
      block(40_000, "Ashwagandha came up before this minute."),
      block(60_000, "We talked about sleep."),
      block(80_000, "Ashwagandha helps sleep, they said."),
      block(130_000, "Ashwagandha and sleep, after the minute."),
    ];
    const snippet = transcriptSnippet(blocks, minute, transcriptQueryOf("ashwagandha sleep"));

    assert.equal(snippet?.startMs, 80_000);
    assert.equal(snippet?.text, "Ashwagandha helps sleep, they said.");
    assert.deepEqual(marked(snippet!.text, snippet!.marks), ["Ashwagandha", "sleep"]);
  });

  it("cuts a long paragraph at sentence edges around the first match", () => {
    const opening = "This opening sentence goes on for a while about nothing in particular at all. ";
    const middle = "Then she named the drug: modafinil. ";
    const closing = "And the closing sentence wanders off into something else entirely, at length, without end.";
    const snippet = transcriptSnippet([block(60_000, opening + middle + closing)], minute, transcriptQueryOf("modafinil"))!;

    assert.ok(snippet.text.length <= SNIPPET_MAX_CHARS);
    assert.ok(snippet.text.includes("Then she named the drug: modafinil."));
    assert.match(snippet.text, /^[A-Z].*[.]$/);
    assert.deepEqual(marked(snippet.text, snippet.marks), ["modafinil"]);
  });

  it("cuts a machine-heard paragraph with no sentences at word edges, with ellipses", () => {
    const words = Array.from({ length: 80 }, (_, index) => `word${index}`);
    words[40] = "modafinil";
    const snippet = transcriptSnippet([block(60_000, words.join(" "))], minute, transcriptQueryOf("modafinil"))!;

    assert.ok(snippet.text.length <= SNIPPET_MAX_CHARS + 2);
    assert.match(snippet.text, /^….*…$/);
    assert.match(snippet.text, /(^| )modafinil( |$)/);
    assert.match(snippet.text, /^…word\d+ .* word\d+…$/);
  });

  it("has nothing to show for a minute with no paragraphs", () => {
    assert.equal(transcriptSnippet([block(0, "Too early.")], minute, transcriptQueryOf("early")), null);
  });
});
