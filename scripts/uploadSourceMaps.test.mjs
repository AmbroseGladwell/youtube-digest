import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { uploadSourceMaps } from "./uploadSourceMaps.mjs";

function builtApp() {
  const dir = mkdtempSync(path.join(tmpdir(), "uploadSourceMaps-test-"));
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "assets", "index-abc.js"), "export {};");
  writeFileSync(path.join(dir, "assets", "index-abc.js.map"), "{}");
  writeFileSync(path.join(dir, "assets", "chunk-def.js.map"), "{}");
  return dir;
}

const recording = () => {
  const runs = [];
  return { runs, run: (args, env) => runs.push({ args, env }) };
};

const silent = () => {};

test("with a key, the maps are injected and uploaded under this release, then deleted", () => {
  const dir = builtApp();
  const { runs, run } = recording();

  const result = uploadSourceMaps({
    dir,
    releaseName: "overview-web",
    env: { POSTHOG_CLI_API_KEY: "phx_test", POSTHOG_CLI_PROJECT_ID: "12345", BUILD_COMMIT: "0123456789abcdef0123" },
    run,
    log: silent,
  });

  assert.deepEqual(result, { maps: 2, uploaded: true });
  assert.equal(runs.length, 1);
  const { args, env } = runs[0];
  assert.deepEqual(args.slice(0, 5), ["--host", "https://eu.posthog.com", "sourcemap", "process", "--directory"]);
  assert.equal(args[args.indexOf("--release-name") + 1], "overview-web");
  assert.match(args[args.indexOf("--release-version") + 1], /^\d+\.\d+\.\d+\+0123456789ab$/);
  assert.equal(env.POSTHOG_CLI_API_KEY, "phx_test");
  assert.equal(existsSync(path.join(dir, "assets", "index-abc.js.map")), false);
  assert.equal(existsSync(path.join(dir, "assets", "index-abc.js")), true);
});

test("without a key, nothing is uploaded and the maps are still deleted, so none is ever served", () => {
  const dir = builtApp();
  const { runs, run } = recording();

  const result = uploadSourceMaps({ dir, releaseName: "overview-web", env: { POSTHOG_CLI_API_KEY: " " }, run, log: silent });

  assert.deepEqual(result, { maps: 2, uploaded: false });
  assert.deepEqual(runs, []);
  assert.equal(existsSync(path.join(dir, "assets", "chunk-def.js.map")), false);
});

test("an upload that fails stops the build rather than shipping a release PostHog can't read", () => {
  const dir = builtApp();

  assert.throws(() =>
    uploadSourceMaps({
      dir,
      releaseName: "overview-web",
      env: { POSTHOG_CLI_API_KEY: "phx_test", POSTHOG_CLI_PROJECT_ID: "12345" },
      run: () => {
        throw new Error("posthog-cli exited 1");
      },
      log: silent,
    }),
  );
});
