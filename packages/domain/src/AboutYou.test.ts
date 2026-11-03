import test from "node:test";
import assert from "node:assert/strict";
import { aboutYouSectionText, aboutYouSentence, EMPTY_ABOUT_YOU } from "./AboutYou.js";

test("an empty sentence composes to nothing", () => {
  assert.equal(aboutYouSentence(EMPTY_ABOUT_YOU), "");
});

test("every section filled reads as one sentence", () => {
  assert.equal(
    aboutYouSentence({
      who: ["dad", "husband"],
      time: ["software", "basketball", "DIY"],
      focus: ["money", "new recipes"],
    }),
    "I'm a dad and a husband, I spend my time on software, basketball and DIY, and right now I'm focusing on money and new recipes.",
  );
});

test("an empty section is left out and the sentence still reads", () => {
  assert.equal(
    aboutYouSentence({ ...EMPTY_ABOUT_YOU, who: ["dad"], focus: ["sleep"] }),
    "I'm a dad, and right now I'm focusing on sleep.",
  );
  assert.equal(aboutYouSentence({ ...EMPTY_ABOUT_YOU, focus: ["sleep"] }), "Right now I'm focusing on sleep.");
});

test("who you are takes the article the entry needs, and only there", () => {
  assert.equal(aboutYouSectionText("who", ["engineer", "homeowner"]), "an engineer and a homeowner");
  assert.equal(aboutYouSectionText("who", ["retired", "a youth coach", "my kids' taxi"]), "retired, a youth coach and my kids' taxi");
  assert.equal(aboutYouSectionText("time", ["software"]), "software");
});
