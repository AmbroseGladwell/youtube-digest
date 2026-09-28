import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

export function packExtension({ distDir, releaseDir }) {
  const manifestPath = path.join(distDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`${distDir} holds no manifest.json: build the extension first`);
  }
  const manifest = storeManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  const zipPath = path.join(releaseDir, `the-overview-${manifest.version}.zip`);

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
  if (packed.key !== undefined || packed.version !== manifest.version) {
    throw new Error(`${zipPath} does not carry the manifest that was written into it`);
  }
  return { zipPath, version: manifest.version, files };
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const extensionDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/extension");
  try {
    const { zipPath, version, files } = packExtension({
      distDir: path.join(extensionDir, "dist"),
      releaseDir: path.join(extensionDir, "release"),
    });
    console.log(`packed version ${version}, ${files.length} files, at ${zipPath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
