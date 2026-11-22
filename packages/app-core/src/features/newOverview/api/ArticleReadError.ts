import type { ArticleRead } from "@overview/domain";

export type ArticleFailure = Extract<ArticleRead, { status: "failed" }>;

export class ArticleReadError extends Error {
  readonly failure: ArticleFailure;

  constructor(failure: ArticleFailure) {
    super(`The article could not be read: ${failure.reason}`);
    this.failure = failure;
  }
}
