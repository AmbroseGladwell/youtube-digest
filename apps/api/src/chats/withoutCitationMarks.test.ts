import test from "node:test";
import assert from "node:assert/strict";
import { withoutCitationMarks } from "./withoutCitationMarks.js";

test("drops the ids an answer wrote into its text, in every form the harness run saw", () => {
  const seen: Array<[string, string]> = [
    ["It lasted 43 days. [p28–p30]", "It lasted 43 days."],
    ["Some counts are higher. [p54–p56, p8]", "Some counts are higher."],
    ["Beyond the video. [p26] [p27]", "Beyond the video."],
    ["She soothes them in distress (p8–p9). During a tantrum", "She soothes them in distress. During a tantrum"],
    ["She makes that claim in the video (p16–p17).", "She makes that claim in the video."],
    ["Rather than build its own traffic data. [kp4]", "Rather than build its own traffic data."],
    ["Attacks could happen again. [dubious1] [p80]", "Attacks could happen again."],
    ["As you said before [c1.m3], start small.", "As you said before, start small."],
    ["Misbehaviour to punish. [p96, p158, p160]", "Misbehaviour to punish."],
  ];
  for (const [answer, shown] of seen) {
    assert.equal(withoutCitationMarks(answer), shown);
  }
});

test("drops a mark whatever separates its ids, and a bracket left holding only separators", () => {
  const seen: Array<[string, string]> = [
    ["Take 3–5 g a day. (p3; step1)", "Take 3–5 g a day."],
    ["Take 3–5 g a day to saturate muscle stores. (;)", "Take 3–5 g a day to saturate muscle stores."],
    ["Take 3–5 g a day. ( , )", "Take 3–5 g a day."],
    ["Take 3–5 g a day (p3 and kp2), then stop.", "Take 3–5 g a day, then stop."],
    ["Take 3–5 g a day. [p3;]", "Take 3–5 g a day."],
  ];
  for (const [answer, shown] of seen) {
    assert.equal(withoutCitationMarks(answer), shown);
  }
});

test("leaves brackets that are prose alone", () => {
  for (const prose of [
    "Take it (perhaps 3g) daily.",
    "The [sic] spelling.",
    "Step 2 (p. 4 of the guide).",
    "Pages (2 and 3) cover it.",
    "Doses (3; 5 at most) vary.",
    "An empty () pair.",
  ]) {
    assert.equal(withoutCitationMarks(prose), prose);
  }
});

const arriving = (whole: string): string[] => {
  return Array.from({ length: whole.length + 1 }, (_, end) => withoutCitationMarks(whole.slice(0, end), { arriving: true }));
};

const onlyGrows = (seen: string[]): boolean => {
  return seen.every((text, index) => index === 0 || text.startsWith(seen[index - 1]!));
};

test("while the reply arrives, the text only grows and never shows half a mark", () => {
  const whole = "It lasted 43 days [p28–p30], then (perhaps) more. [kp4]";
  const seen = arriving(whole);
  assert.ok(onlyGrows(seen), "the text only ever grows");
  assert.ok(seen.every((text) => !/\[p|\[k/.test(text)));
  assert.equal(withoutCitationMarks(whole), "It lasted 43 days, then (perhaps) more.");
});

test("while the reply arrives, a mark of other separators or of separators alone never shows", () => {
  const whole = "Take 3–5 g a day (p3; step1), then ( , ) less. (;)";
  const seen = arriving(whole);
  assert.ok(onlyGrows(seen), "the text only ever grows");
  assert.ok(seen.every((text) => !/[[(]\s*[p;,]/.test(text)));
  assert.equal(seen.at(-1), "Take 3–5 g a day, then less.");
  assert.equal(withoutCitationMarks(whole), "Take 3–5 g a day, then less.");
});

test("drops another overview's label and its items' ids (OV-355)", () => {
  const seen: Array<[string, string]> = [
    ["Swap the cream for yoghurt, as Dr Rupy suggests. [S2.kp1]", "Swap the cream for yoghurt, as Dr Rupy suggests."],
    ["Both agree on fibre (S1.apply2; S3.kp4).", "Both agree on fibre."],
    ["The lentil curry fits best [S7].", "The lentil curry fits best."],
    ["Start with beans (S2.step1, p4), then greens.", "Start with beans, then greens."],
  ];
  for (const [answer, shown] of seen) {
    assert.equal(withoutCitationMarks(answer), shown);
  }
});

test("drops a library or project overview's label and its items' ids (OV-353)", () => {
  const seen: Array<[string, string]> = [
    ["Charge from day one (O3.kp2).", "Charge from day one."],
    ["Most start small [O1, O4].", "Most start small."],
  ];
  for (const [answer, shown] of seen) {
    assert.equal(withoutCitationMarks(answer, { library: true }), shown);
  }
  assert.equal(withoutCitationMarks("Breathe in oxygen (O2) slowly."), "Breathe in oxygen (O2) slowly.");
});
