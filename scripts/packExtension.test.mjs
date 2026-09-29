import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { packExtension, storeManifest } from "./packExtension.mjs";

const KEY = "MIIB…";

function builtExtension(manifest) {
  const root = mkdtempSync(path.join(tmpdir(), "packExtension-test-"));
  const distDir = path.join(root, "dist");
  mkdirSync(path.join(distDir, "chunks"), { recursive: true });
  writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(manifest));
  writeFileSync(path.join(distDir, "sidepanel.html"), "<div id=\"root\"></div>");
  writeFileSync(path.join(distDir, "chunks", "app-abc123.js"), "export {};");
  writeFileSync(path.join(distDir, ".DS_Store"), "");
  return { root, distDir, releaseDir: path.join(root, "release") };
}

const manifestIn = (zipPath) => JSON.parse(execFileSync("unzip", ["-p", zipPath, "manifest.json"], { encoding: "utf8" }));

test("the store's zip holds the build at its root, named by its version, with the key stripped", () => {
  const built = builtExtension({ name: "The Overview", version: "0.1.0", key: KEY });
  try {
    const { version, zips } = packExtension(built);
    const [store] = zips;

    assert.equal(version, "0.1.0");
    assert.equal(store.keyed, false);
    assert.equal(path.basename(store.zipPath), "the-overview-0.1.0.zip");
    assert.ok(existsSync(store.zipPath));
    assert.deepEqual(store.files.sort(), ["chunks/", "chunks/app-abc123.js", "manifest.json", "sidepanel.html"]);
    assert.deepEqual(manifestIn(store.zipPath), { name: "The Overview", version: "0.1.0" });
  } finally {
    rmSync(built.root, { recursive: true, force: true });
  }
});

test("a keyed zip is packed beside it, the same build with the store's key kept", () => {
  const built = builtExtension({ name: "The Overview", version: "0.1.0", key: KEY });
  try {
    const { zips } = packExtension(built);
    const keyed = zips.find((zip) => zip.keyed);

    assert.equal(zips.length, 2);
    assert.equal(path.basename(keyed.zipPath), "the-overview-0.1.0-unpacked.zip");
    assert.deepEqual(manifestIn(keyed.zipPath), { name: "The Overview", version: "0.1.0", key: KEY });
    assert.deepEqual(keyed.files.sort(), zips[0].files.sort());
  } finally {
    rmSync(built.root, { recursive: true, force: true });
  }
});

test("a build whose manifest has no key yet packs the store's zip alone", () => {
  const built = builtExtension({ name: "The Overview", version: "0.1.0" });
  try {
    const { zips } = packExtension(built);

    assert.deepEqual(zips.map((zip) => zip.keyed), [false]);
    assert.ok(!existsSync(path.join(built.releaseDir, "the-overview-0.1.0-unpacked.zip")));
  } finally {
    rmSync(built.root, { recursive: true, force: true });
  }
});

test("the unreleased version is refused before anything is zipped", () => {
  const built = builtExtension({ name: "The Overview", version: "0.0.0" });
  try {
    assert.throws(() => packExtension(built), /not a release/);
    assert.ok(!existsSync(built.releaseDir));
  } finally {
    rmSync(built.root, { recursive: true, force: true });
  }
  assert.throws(() => storeManifest({ name: "The Overview" }), /not a release/);
});

test("a directory that was never built is refused by name", () => {
  const root = mkdtempSync(path.join(tmpdir(), "packExtension-test-"));
  try {
    assert.throws(
      () => packExtension({ distDir: path.join(root, "dist"), releaseDir: path.join(root, "release") }),
      /build the extension first/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
