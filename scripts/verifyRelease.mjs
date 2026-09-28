import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHORT_SHA_LENGTH = 7;

function readJsonFromZip(zipPath, name) {
  let text;
  try {
    text = execFileSync("unzip", ["-p", zipPath, name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error(`${path.basename(zipPath)} holds no ${name}`);
  }
  return JSON.parse(text);
}

// The zip about to be attached to a release is the one built from the commit being
// deployed, at the version being tagged, or the release does not happen
// (docs/architecture/deploy.md, "Tags and releases").
export function verifyRelease({ zipPath, version, commit }) {
  const shortCommit = commit.slice(0, SHORT_SHA_LENGTH);
  const manifest = readJsonFromZip(zipPath, "manifest.json");
  const build = readJsonFromZip(zipPath, "build.json");
  const problems = [];
  if (manifest.version !== version) problems.push(`its manifest is at ${manifest.version}, not ${version}`);
  if (manifest.key !== undefined) problems.push("its manifest still carries the key");
  if (build.version !== version) problems.push(`it was built as ${build.version}, not ${version}`);
  if (build.commit !== shortCommit) problems.push(`it was built from ${build.commit}, not ${shortCommit}`);
  if (build.dirty === true) problems.push("it was built from a tree with uncommitted changes");
  if (problems.length > 0) {
    throw new Error(`${path.basename(zipPath)} is not the release: ${problems.join("; ")}`);
  }
  return { version, commit: shortCommit };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const commit = process.argv[2];
  if (commit === undefined || commit === "") {
    console.error("usage: node scripts/verifyRelease.mjs <commit sha>");
    process.exit(2);
  }
  try {
    const { version } = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
    const zipPath = path.join(rootDir, "apps/extension/release", `the-overview-${version}.zip`);
    const checked = verifyRelease({ zipPath, version, commit });
    console.log(`${path.basename(zipPath)} is version ${checked.version} built from ${checked.commit}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
