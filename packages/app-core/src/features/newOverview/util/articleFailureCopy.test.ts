import { describe, expect, it } from "vitest";
import { ArticleReadFailure } from "@overview/domain";
import { articleFailureCopy } from "./articleFailureCopy.js";

const URL_OF_PAGE = "https://www.harbourpost.example/bridge";

describe("articleFailureCopy", () => {
  it("says nothing counted on every failure", () => {
    for (const reason of ArticleReadFailure.options) {
      expect(articleFailureCopy({ status: "failed", reason }, URL_OF_PAGE).body).toMatch(/othing( was made, and nothing)? counted/);
    }
  });

  it("names the words the page gave and whose paywall it is", () => {
    const { body } = articleFailureCopy({ status: "failed", reason: "paywalled", shownWords: 1180, siteName: "The Harbour Post" }, URL_OF_PAGE);
    expect(body).toMatch(/1,180 words/);
    expect(body).toMatch(/The Harbour Post’s paywall/);
  });

  it("names a page that gave no site name by its address", () => {
    expect(articleFailureCopy({ status: "failed", reason: "paywalled", shownWords: 90 }, URL_OF_PAGE).body).toMatch(/harbourpost\.example’s paywall/);
  });

  it("offers no way forward from a dead end, rather than a button that can't help", () => {
    expect(articleFailureCopy({ status: "failed", reason: "nothing-readable" }, URL_OF_PAGE).way).toBeNull();
    expect(articleFailureCopy({ status: "failed", reason: "no-access" }, URL_OF_PAGE).way).toBeNull();
  });
});
