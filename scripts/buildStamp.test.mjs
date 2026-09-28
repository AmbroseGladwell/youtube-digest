import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildStamp } from "./buildStamp.mjs";

const FULL_SHA = "30bb95a1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7";

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function checkout({ version = "0.1.0", committed = true } = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), "buildStamp-test-"));
  writeFileSync(path.join(cwd, "package.json"), JSON.stringify(version === null ? {} : { version }));
  if (!committed) return cwd;
  git(cwd, ["init", "--quiet", "--initial-branch=main"]);
  git(cwd, ["config", "user.email", "test@example.com"]);
  git(cwd, ["config", "user.name", "Test"]);
  git(cwd, ["config", "commit.gpgsign", "false"]);
  git(cwd, ["add", "package.json"]);
  git(cwd, ["commit", "--quiet", "--message", "first"]);
  return cwd;
}

const stampOf = (cwd, env = {}) => buildStamp({ env, cwd, rootDir: cwd });

test("a clean checkout is stamped with the root version and its short commit", () => {
  const cwd = checkout({ version: "1.4.0" });
  try {
    const stamp = stampOf(cwd);

    assert.deepEqual(stamp, { version: "1.4.0", commit: git(cwd, ["rev-parse", "--short=7", "HEAD"]), dirty: false });
    assert.equal(stamp.commit.length, 7);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a change to a tracked file marks the build dirty, an untracked file does not", () => {
  const cwd = checkout();
  try {
    writeFileSync(path.join(cwd, "scratch.txt"), "not added\n");
    assert.equal(stampOf(cwd).dirty, false);

    writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ version: "0.1.0", name: "x" }));
    assert.equal(stampOf(cwd).dirty, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("BUILD_COMMIT stands in for git, shortened, and is taken as clean", () => {
  const cwd = checkout();
  try {
    assert.deepEqual(stampOf(cwd, { BUILD_COMMIT: FULL_SHA }), { version: "0.1.0", commit: "30bb95a", dirty: false });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("outside any checkout, with nothing in the environment, the commit is unknown", () => {
  const cwd = checkout({ committed: false });
  try {
    assert.deepEqual(stampOf(cwd, { BUILD_COMMIT: "  " }), { version: "0.1.0", commit: null, dirty: false });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("the placeholder version, or none, fails the build rather than shipping as a release", () => {
  for (const version of ["0.0.0", null]) {
    const cwd = checkout({ version, committed: false });
    try {
      assert.throws(() => stampOf(cwd), /not a release: bump it with task version:bump/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  }
});
