import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isEmptyTranscriptQuery, transcriptQueryOf } from "./transcriptQueryOf.js";

describe("transcriptQueryOf", () => {
  it("splits plain words, lowercased, without punctuation or repeats", () => {
    assert.deepEqual(transcriptQueryOf("Ashwagandha, 300 mg! ashwagandha"), { phrases: [], words: ["ashwagandha", "300", "mg"] });
  });

  it("keeps a quoted run of words as a phrase, apart from the words around it", () => {
    assert.deepEqual(transcriptQueryOf('sleep "dim the lights" “cool room”'), {
      phrases: ["dim the lights", "cool room"],
      words: ["sleep"],
    });
  });

  it("treats a quoted single word as a word, and an unclosed quote as plain words", () => {
    assert.deepEqual(transcriptQueryOf('"magnesium"'), { phrases: [], words: ["magnesium"] });
    assert.deepEqual(transcriptQueryOf('"magnesium glycinate'), { phrases: [], words: ["magnesium", "glycinate"] });
  });

  it("keeps apostrophes and hyphens inside a word and folds accents", () => {
    assert.deepEqual(transcriptQueryOf("Huberman's café co-founder"), { phrases: [], words: ["huberman's", "cafe", "co-founder"] });
  });

  it("is empty for nothing but punctuation", () => {
    assert.equal(isEmptyTranscriptQuery(transcriptQueryOf(' " ? ! " ')), true);
  });
});
