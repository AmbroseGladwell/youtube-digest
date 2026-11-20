import test from "node:test";
import assert from "node:assert/strict";
import { answerSoFar } from "./answerSoFar.js";
import { sectionsSoFar } from "./sectionsSoFar.js";

const reply = JSON.stringify({
  intro: "Most start small.",
  sections: [
    { heading: "Scope {tight}", points: [{ text: 'One "habit" [first].', sources: ["O1", "O2.kp1"] }] },
    { heading: "Money", points: [{ text: "Charge early.", sources: ["O3"] }] },
  ],
  takeaway: "Pick one.",
});

test("a section is read once its closing brace arrives, never before, whatever braces its strings hold", () => {
  const seen: number[] = [];
  for (let end = 0; end <= reply.length; end += 1) seen.push(sectionsSoFar(reply.slice(0, end)).length);
  const first = seen.indexOf(1);
  const second = seen.indexOf(2);
  assert.ok(first > reply.indexOf("Scope") && first < reply.indexOf("Money"));
  assert.ok(second > reply.indexOf("Charge early."));
  assert.deepEqual(sectionsSoFar(reply), JSON.parse(reply).sections);
  assert.ok(seen.every((count, index) => index === 0 || count >= seen[index - 1]!));
});

test("the intro streams as the first field, and nothing is read before the sections begin", () => {
  assert.equal(answerSoFar('{"intro":"Most st', "intro"), "Most st");
  assert.deepEqual(sectionsSoFar('{"intro":"Most start small.","sec'), []);
  assert.deepEqual(sectionsSoFar('{"intro":"x","sections":[]'), []);
});
