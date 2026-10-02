import test from "node:test";
import assert from "node:assert/strict";
import { deployedCommitsOf, ttsDeployDecision, verifyTtsDeploy } from "./ttsDeployDecision.mjs";

const OLD = "a".repeat(40);
const LIVE = "b".repeat(40);
const HEAD = "c".repeat(40);

// A straight line of history, OLD → LIVE → HEAD, with services/tts changed or not between LIVE and HEAD.
const line = ({ ttsChanged = false, known = [OLD, LIVE, HEAD] } = {}) => ({
  exists: (commit) => known.includes(commit),
  isAncestor: (older, newer) => known.indexOf(older) !== -1 && known.indexOf(older) <= known.indexOf(newer),
  changed: () => ttsChanged,
});

const decide = (deployedCommits, git) => ttsDeployDecision({ deployedCommits, head: HEAD, git }).deploy;

test("a change to services/tts since the live commit is deployed", () => {
  assert.equal(decide([LIVE, LIVE], line({ ttsChanged: true })), true);
});

test("nothing changed in services/tts since the live commit, so nothing is deployed", () => {
  assert.equal(decide([LIVE, LIVE], line()), false);
});

test("the commit already live is not deployed again", () => {
  assert.equal(decide([HEAD, HEAD], line({ ttsChanged: true })), false);
});

test("a re-run of an older run never rolls back what is live", () => {
  const git = line({ ttsChanged: true, known: [OLD, HEAD, LIVE] });
  assert.equal(decide([LIVE], git), false);
});

test("machines this job never deployed, or on different commits, are deployed", () => {
  assert.equal(decide([null, null], line()), true);
  assert.equal(decide([LIVE, OLD], line()), true);
});

test("a live commit outside this history, or off to the side of it, is deployed over", () => {
  assert.equal(decide(["d".repeat(40)], line()), true);
  const sideways = { exists: () => true, isAncestor: () => false, changed: () => false };
  assert.equal(decide([LIVE], sideways), true);
});

test("each machine's live commit is read from the env the last deploy stamped", () => {
  const machines = [{ config: { env: { DEPLOYED_COMMIT: LIVE, IDLE_EXIT_SECONDS: "15" } } }, { config: { env: {} } }];
  assert.deepEqual(deployedCommitsOf(machines), [LIVE, null]);
});

test("a deploy is verified only when every machine reports the new commit", () => {
  assert.match(verifyTtsDeploy({ deployedCommits: [HEAD, HEAD], head: HEAD }), /all 2 machines/);
  assert.throws(() => verifyTtsDeploy({ deployedCommits: [HEAD, LIVE], head: HEAD }), /1 of 2 machines/);
  assert.throws(() => verifyTtsDeploy({ deployedCommits: [], head: HEAD }));
});
