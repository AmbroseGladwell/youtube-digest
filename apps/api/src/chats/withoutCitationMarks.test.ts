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
  for (const [answer, shown] of seen) assert.equal(withoutCitationMarks(answer), shown);
});

test("leaves brackets that are prose alone", () => {
  for (const prose of ["Take it (perhaps 3g) daily.", "The [sic] spelling.", "Step 2 (p. 4 of the guide)."]) {
    assert.equal(withoutCitationMarks(prose), prose);
  }
});

test("while the reply arrives, the text only grows and never shows half a mark", () => {
  const whole = "It lasted 43 days [p28–p30], then (perhaps) more. [kp4]";
  const seen = Array.from({ length: whole.length + 1 }, (_, end) => withoutCitationMarks(whole.slice(0, end), { arriving: true }));
  assert.ok(
    seen.every((text, index) => index === 0 || text.startsWith(seen[index - 1]!)),
    "the text only ever grows",
  );
  assert.ok(seen.every((text) => !/\[p|\[k/.test(text)));
  assert.equal(withoutCitationMarks(whole), "It lasted 43 days, then (perhaps) more.");
});
