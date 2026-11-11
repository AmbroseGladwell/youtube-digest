import test from "node:test";
import assert from "node:assert/strict";
import { reasonClaims } from "./reasonClaims.js";

test("the Dr K reason's count and time claims are flagged", () => {
  const claims = reasonClaims(
    "Skip the video, the overview covers it. It is two men talking on a podcast, and the protocol is four simple instructions that read perfectly well in text. Much of the running time is jokes and a sponsor read.",
  );
  assert.ok(claims.some((claim) => claim.startsWith("four")));
  assert.ok(claims.some((claim) => /much of the running time/i.test(claim)));
});

test("digits, percentages and durations are flagged", () => {
  assert.deepEqual(reasonClaims("About 40% of it is a 10 minute ad."), ["40%", "10 minute"]);
});

test("a reason that neither counts nor times anything flags nothing", () => {
  assert.deepEqual(reasonClaims("No, the overview covers the argument and the demo adds nothing visual."), []);
});
