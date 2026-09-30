import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createFileAudioStore } from "./fileAudioStore.js";

const KEY = "a".repeat(64);

test("what is put under a key is read back exactly, from a directory it makes itself", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "audio-store-"));
  const store = createFileAudioStore(path.join(root, "audio"));

  await store.put(KEY, Buffer.from("narration"));

  assert.deepEqual(await store.get(KEY), Buffer.from("narration"));
  assert.deepEqual(await readdir(path.join(root, "audio")), [`${KEY}.m4a`]);
  await rm(root, { recursive: true });
});

test("a key nothing was put under reads back as nothing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "audio-store-"));

  assert.equal(await createFileAudioStore(root).get(KEY), null);
  await rm(root, { recursive: true });
});
