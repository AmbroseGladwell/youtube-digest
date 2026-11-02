import test from "node:test";
import assert from "node:assert/strict";
import { ArticleReadFailure } from "@overview/domain";
import { articleFailureCopy } from "./articleFailureCopy.js";

const URL_OF_PAGE = "https://www.harbourpost.example/bridge";

test("every failure says nothing counted", () => {
  for (const reason of ArticleReadFailure.options) {
    assert.match(articleFailureCopy({ status: "failed", reason }, URL_OF_PAGE).body, /othing( was made, and nothing)? counted/);
  }
});

test("a paywall names the words the page gave and whose paywall it is", () => {
  const { body } = articleFailureCopy({ status: "failed", reason: "paywalled", shownWords: 1180, siteName: "The Harbour Post" }, URL_OF_PAGE);
  assert.match(body, /1,180 words/);
  assert.match(body, /The Harbour Post’s paywall/);
});

test("a page that gave no site name is named by its address", () => {
  assert.match(articleFailureCopy({ status: "failed", reason: "paywalled", shownWords: 90 }, URL_OF_PAGE).body, /harbourpost\.example’s paywall/);
});

test("a dead end offers no way forward, rather than a button that can't help", () => {
  assert.equal(articleFailureCopy({ status: "failed", reason: "nothing-readable" }, URL_OF_PAGE).way, null);
  assert.equal(articleFailureCopy({ status: "failed", reason: "no-access" }, URL_OF_PAGE).way, null);
});
