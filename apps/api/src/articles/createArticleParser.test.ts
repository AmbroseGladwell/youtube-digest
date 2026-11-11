import test from "node:test";
import assert from "node:assert/strict";
import type { ArticleRead } from "@overview/domain";
import { createArticleParser } from "./createArticleParser.js";

const scripted = () =>
  createArticleParser({ workerUrl: new URL("./ScriptedParseWorker.testHelper.js", import.meta.url), timeoutMs: 1_000, heapLimitMb: 64 });

const answeredBy = (read: ArticleRead): string => (read.status === "failed" ? (read.siteName ?? read.reason) : "read");

const threadOf = (read: ArticleRead): string => answeredBy(read).split("@")[1]!;

test("reads every page on the same warm worker, in the order they came", async () => {
  const parse = scripted();
  const reads = await Promise.all(["a", "b", "c"].map((page) => parse(page, "https://example.com/")));
  assert.deepEqual(
    reads.map((read) => answeredBy(read).split("@")[0]),
    ["a", "b", "c"],
  );
  assert.equal(new Set(reads.map(threadOf)).size, 1);
});

test("gives up on a page that outruns the limit, and reads the next on a fresh worker", async () => {
  const parse = scripted();
  const before = await parse("a", "https://example.com/");
  const [hung, after] = await Promise.all([parse("hang", "https://example.com/"), parse("b", "https://example.com/")]);
  assert.deepEqual(hung, { status: "failed", reason: "unfinished" });
  assert.equal(answeredBy(after).split("@")[0], "b");
  assert.notEqual(threadOf(after), threadOf(before));
});

test("answers unfinished when the worker fails, and reads the next on a fresh worker", async () => {
  const parse = scripted();
  const before = await parse("a", "https://example.com/");
  const [failed, after] = await Promise.all([parse("throw", "https://example.com/"), parse("b", "https://example.com/")]);
  assert.deepEqual(failed, { status: "failed", reason: "unfinished" });
  assert.notEqual(threadOf(after), threadOf(before));
});
