import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const UNRELEASED_VERSION = "0.0.0";

// The zip the Web Store takes: the built extension with its manifest's key removed, since
// the store refuses a key on a new item and needs it on no upload
// (docs/architecture/deploy.md, "The extension").
export function storeManifest(manifest) {
  if (manifest.version === undefined || manifest.version === UNRELEASED_VERSION) {
    throw new Error(
      `manifest.json is at version ${manifest.version ?? "(none)"}, which is not a release: the build stamps it from the root package.json`,
    );
  }
  const { key: _key, ...rest } = manifest;
  return rest;
}

export function hasStoreKey(manifest) {
  return typeof manifest.key === "string" && manifest.key !== "";
}

export function keyedZipName(version) {
  return `the-overview-${version}-unpacked.zip`;
}

export function storeZipName(version) {
  return `the-overview-${version}.zip`;
}

function zipWithManifest({ distDir, releaseDir, zipPath, manifest }) {
  const staging = mkdtempSync(path.join(tmpdir(), "overview-extension-"));
  try {
    cpSync(distDir, staging, { recursive: true });
    writeFileSync(path.join(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    mkdirSync(releaseDir, { recursive: true });
    rmSync(zipPath, { force: true });
    execFileSync("zip", ["-r", "-X", "-q", zipPath, ".", "-x", ".DS_Store", "*/.DS_Store"], { cwd: staging });
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }

  const files = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" }).split("\n").filter(Boolean);
  if (!files.includes("manifest.json")) {
    throw new Error(`${zipPath} has no manifest.json at its root; Chrome would refuse it`);
  }
  const packed = JSON.parse(execFileSync("unzip", ["-p", zipPath, "manifest.json"], { encoding: "utf8" }));
  if (!isDeepStrictEqual(packed, manifest)) {
    throw new Error(`${zipPath} does not carry the manifest that was written into it`);
  }
  return { zipPath, files };
}

// Two zips, because the store's and a person's needs are opposite: the store refuses a
// manifest with a key, and a build loaded unpacked without one gets an id derived from
// its directory, which the API does not vouch for (docs/architecture/deploy.md,
// "The extension").
export function packExtension({ distDir, releaseDir }) {
  const manifestPath = path.join(distDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`${distDir} holds no manifest.json: build the extension first`);
  }
  const built = JSON.parse(readFileSync(manifestPath, "utf8"));
  const forStore = storeManifest(built);
  const { version } = forStore;

  const zips = [
    {
      ...zipWithManifest({
        distDir,
        releaseDir,
        zipPath: path.join(releaseDir, storeZipName(version)),
        manifest: forStore,
      }),
      keyed: false,
    },
  ];
  if (hasStoreKey(built)) {
    zips.push({
      ...zipWithManifest({
        distDir,
        releaseDir,
        zipPath: path.join(releaseDir, keyedZipName(version)),
        manifest: built,
      }),
      keyed: true,
    });
  }
  return { version, zips };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const extensionDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/extension");
  try {
    const { version, zips } = packExtension({
      distDir: path.join(extensionDir, "dist"),
      releaseDir: path.join(extensionDir, "release"),
    });
    for (const { zipPath, files, keyed } of zips) {
      const what = keyed ? "keyed, to load unpacked" : "for the Web Store";
      console.log(`packed version ${version} ${what}, ${files.length} files, at ${zipPath}`);
    }
    if (!zips.some(({ keyed }) => keyed)) {
      console.log(
        "manifest.json carries no key, so no keyed zip was packed: loaded unpacked, this build gets an id derived from its directory (docs/architecture/deploy.md)",
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
