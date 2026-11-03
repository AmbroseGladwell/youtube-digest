import type { ArticleRead } from "@overview/domain";

export type ArticleFailure = Extract<ArticleRead, { status: "failed" }>;

// The page couldn't be read, which is the reader's to act on and has cost them nothing.
export class ArticleReadError extends Error {
  readonly failure: ArticleFailure;

  constructor(failure: ArticleFailure) {
    super(`The article could not be read: ${failure.reason}`);
    this.failure = failure;
  }
}
