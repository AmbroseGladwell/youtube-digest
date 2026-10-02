import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const TTS_PATH = "services/tts";

function gitSucceeds(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export const gitHistory = {
  exists: (commit) => gitSucceeds(["cat-file", "-e", `${commit}^{commit}`]),
  isAncestor: (older, newer) => gitSucceeds(["merge-base", "--is-ancestor", older, newer]),
  changed: (from, to) => !gitSucceeds(["diff", "--quiet", from, to, "--", TTS_PATH]),
};

// What each machine says it is running: the commit the last deploy stamped on its env.
export function deployedCommitsOf(machines) {
  return machines.map((machine) => machine?.config?.env?.DEPLOYED_COMMIT ?? null);
}

// Whether HEAD's services/tts differs from what is live, judged against the live commit
// rather than the previous push, because CI cancels superseded runs on main
// (docs/architecture/deploy.md, "The TTS service").
export function ttsDeployDecision({ deployedCommits, head, git = gitHistory }) {
  const known = [...new Set(deployedCommits)];
  if (deployedCommits.length === 0) return { deploy: true, reason: "the app has no machines to compare" };
  if (known.length !== 1 || known[0] === null) {
    return { deploy: true, reason: "the machines aren't all on one commit this job deployed" };
  }
  const [live] = known;
  if (live === head) return { deploy: false, reason: `${short(head)} is already live` };
  if (!git.exists(live)) return { deploy: true, reason: `the live commit ${short(live)} isn't in this history` };
  if (git.isAncestor(head, live)) return { deploy: false, reason: `the live ${short(live)} is newer than ${short(head)}` };
  if (!git.isAncestor(live, head)) return { deploy: true, reason: `the live ${short(live)} isn't an ancestor of ${short(head)}` };
  return git.changed(live, head)
    ? { deploy: true, reason: `${TTS_PATH} changed between the live ${short(live)} and ${short(head)}` }
    : { deploy: false, reason: `${TTS_PATH} is unchanged since the live ${short(live)}` };
}

export function verifyTtsDeploy({ deployedCommits, head }) {
  const behind = deployedCommits.filter((commit) => commit !== head).length;
  if (deployedCommits.length === 0 || behind > 0) {
    throw new Error(`${behind} of ${deployedCommits.length} machines don't report ${short(head)} after the deploy`);
  }
  return `all ${deployedCommits.length} machines report ${short(head)}`;
}

function short(commit) {
  return commit.slice(0, 7);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, machinesFile, head] = process.argv.slice(2);
  if (!["decide", "verify"].includes(mode) || !machinesFile || !head) {
    console.error("usage: node scripts/ttsDeployDecision.mjs decide|verify <machines.json> <head commit>");
    process.exit(2);
  }
  const deployedCommits = deployedCommitsOf(JSON.parse(readFileSync(machinesFile, "utf8")));
  try {
    if (mode === "verify") {
      console.log(`tts deploy: ${verifyTtsDeploy({ deployedCommits, head })}`);
    } else {
      const { deploy, reason } = ttsDeployDecision({ deployedCommits, head });
      console.log(`tts deploy: ${deploy ? "deploying" : "skipping"}, because ${reason}`);
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${deploy}\n`);
    }
  } catch (error) {
    console.error(`tts deploy: ${error.message}`);
    process.exit(1);
  }
}
