import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_HOST = "https://eu.posthog.com";

function mapsIn(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".map"))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function runPostHogCli(args, env) {
  execFileSync("npx", ["--no-install", "posthog-cli", ...args], { cwd: REPO_ROOT, env, stdio: "inherit" });
}

// A build's maps go to PostHog's error tracking, tied to this release, and never ship: the
// bundle is injected with each chunk's id first, so the injected copy is the one served
// (docs/architecture/errors-and-logs.md, "Source maps"). With no key the maps are only deleted.
export function uploadSourceMaps({ dir, releaseName, env = process.env, run = runPostHogCli, log = console.log }) {
  const maps = mapsIn(dir);
  const apiKey = env.POSTHOG_CLI_API_KEY?.trim();
  const projectId = env.POSTHOG_CLI_PROJECT_ID?.trim();
  let uploaded = false;
  if (maps.length > 0 && apiKey && projectId) {
    const { version } = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
    const commit = env.BUILD_COMMIT?.trim() || env.GITHUB_SHA?.trim();
    const releaseVersion = commit ? `${version}+${commit.slice(0, 12)}` : version;
    run(
      [
        "--host",
        env.POSTHOG_CLI_HOST?.trim() || DEFAULT_HOST,
        "sourcemap",
        "process",
        "--directory",
        dir,
        "--release-name",
        releaseName,
        "--release-version",
        releaseVersion,
      ],
      { ...env, POSTHOG_CLI_API_KEY: apiKey, POSTHOG_CLI_PROJECT_ID: projectId },
    );
    uploaded = true;
    log(`source maps: ${maps.length} uploaded to PostHog as ${releaseName} ${releaseVersion}`);
  } else if (maps.length > 0) {
    log(`source maps: no POSTHOG_CLI_API_KEY and POSTHOG_CLI_PROJECT_ID, so ${maps.length} deleted without uploading`);
  }
  for (const map of mapsIn(dir)) rmSync(map);
  return { maps: maps.length, uploaded };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [dir, releaseName] = process.argv.slice(2);
  if (!dir || !releaseName) {
    console.error("usage: node scripts/uploadSourceMaps.mjs <dist dir> <release name>");
    process.exit(2);
  }
  uploadSourceMaps({ dir: path.resolve(dir), releaseName });
}
