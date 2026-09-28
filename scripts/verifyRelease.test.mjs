import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyRelease } from "./verifyRelease.mjs";

const FULL_SHA = "30bb95a1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7";
const GOOD_MANIFEST = { name: "The Overview", version: "0.1.0" };
const GOOD_BUILD = { version: "0.1.0", commit: "30bb95a", dirty: false };

function releaseZip({ manifest = GOOD_MANIFEST, build = GOOD_BUILD } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "verifyRelease-test-"));
  const files = { "manifest.json": manifest, "build.json": build };
  const names = [];
  for (const [name, value] of Object.entries(files)) {
    if (value === null) continue;
    writeFileSync(path.join(root, name), JSON.stringify(value));
    names.push(name);
  }
  const zipPath = path.join(root, "the-overview-0.1.0.zip");
  execFileSync("zip", ["-q", zipPath, ...names], { cwd: root });
  return { root, zipPath };
}

const check = (zip, overrides = {}) =>
  verifyRelease({ zipPath: zip.zipPath, version: "0.1.0", commit: FULL_SHA, ...overrides });

test("a zip built from the deployed commit at the tagged version passes", () => {
  const zip = releaseZip();
  try {
    assert.deepEqual(check(zip), { version: "0.1.0", commit: "30bb95a" });
  } finally {
    rmSync(zip.root, { recursive: true, force: true });
  }
});

test("a zip built from another commit is refused, naming both", () => {
  const zip = releaseZip({ build: { ...GOOD_BUILD, commit: "abcdef0" } });
  try {
    assert.throws(() => check(zip), /built from abcdef0, not 30bb95a/);
  } finally {
    rmSync(zip.root, { recursive: true, force: true });
  }
});

test("a version that differs in the manifest or the build is refused", () => {
  const manifestOff = releaseZip({ manifest: { ...GOOD_MANIFEST, version: "0.2.0" } });
  const buildOff = releaseZip({ build: { ...GOOD_BUILD, version: "0.0.9" } });
  try {
    assert.throws(() => check(manifestOff), /manifest is at 0.2.0, not 0.1.0/);
    assert.throws(() => check(buildOff), /built as 0.0.9, not 0.1.0/);
  } finally {
    rmSync(manifestOff.root, { recursive: true, force: true });
    rmSync(buildOff.root, { recursive: true, force: true });
  }
});

test("a dirty build, or one whose manifest kept the key, is refused", () => {
  const dirty = releaseZip({ build: { ...GOOD_BUILD, dirty: true } });
  const keyed = releaseZip({ manifest: { ...GOOD_MANIFEST, key: "MIIB…" } });
  try {
    assert.throws(() => check(dirty), /uncommitted changes/);
    assert.throws(() => check(keyed), /still carries the key/);
  } finally {
    rmSync(dirty.root, { recursive: true, force: true });
    rmSync(keyed.root, { recursive: true, force: true });
  }
});

test("a zip with no build.json cannot be vouched for", () => {
  const zip = releaseZip({ build: null });
  try {
    assert.throws(() => check(zip), /holds no build.json/);
  } finally {
    rmSync(zip.root, { recursive: true, force: true });
  }
});
