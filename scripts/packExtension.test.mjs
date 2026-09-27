import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { packExtension, storeManifest } from "./packExtension.mjs";

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

test("the zip holds the build at its root, named by its version, with the key stripped", () => {
  const built = builtExtension({ name: "The Overview", version: "0.1.0", key: "MIIB…" });
  try {
    const { zipPath, version, files } = packExtension(built);

    assert.equal(version, "0.1.0");
    assert.equal(path.basename(zipPath), "the-overview-0.1.0.zip");
    assert.ok(existsSync(zipPath));
    assert.deepEqual(files.sort(), ["chunks/", "chunks/app-abc123.js", "manifest.json", "sidepanel.html"]);
    const packed = JSON.parse(execFileSync("unzip", ["-p", zipPath, "manifest.json"], { encoding: "utf8" }));
    assert.deepEqual(packed, { name: "The Overview", version: "0.1.0" });
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
