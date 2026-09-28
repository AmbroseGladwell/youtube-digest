import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHORT_SHA_LENGTH = 7;
const UNRELEASED_VERSION = "0.0.0";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function checkedOutCommit(cwd) {
  try {
    const commit = git(cwd, ["rev-parse", `--short=${SHORT_SHA_LENGTH}`, "HEAD"]);
    const dirty = git(cwd, ["status", "--porcelain", "--untracked-files=no"]) !== "";
    return { commit, dirty };
  } catch {
    return { commit: null, dirty: false };
  }
}

function releaseVersion(rootDir) {
  const { version } = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  if (typeof version !== "string" || version === UNRELEASED_VERSION) {
    throw new Error(
      `the root package.json is at version ${version ?? "(none)"}, which is not a release: bump it with task version:bump`,
    );
  }
  return version;
}

// What a build knows about itself, baked in by Vite: the one version number the root
// package.json carries, the commit it was made from, and whether the tree had uncommitted
// changes. BUILD_COMMIT stands in for git where there is no checkout, which is the Docker
// image (docs/architecture/deploy.md, "The version").
export function buildStamp({ env = process.env, cwd = process.cwd(), rootDir = REPO_ROOT } = {}) {
  const version = releaseVersion(rootDir);
  const fromEnv = env.BUILD_COMMIT?.trim();
  const { commit, dirty } = fromEnv
    ? { commit: fromEnv.slice(0, SHORT_SHA_LENGTH), dirty: false }
    : checkedOutCommit(cwd);
  return { version, commit, dirty };
}
