import type { HeldOverview } from "@overview/domain";

// Known only once the page is read: two addresses can name one article, and the canonical one is on it.
export class ArticleAlreadyHeldError extends Error {
  readonly held: HeldOverview;

  constructor(held: HeldOverview) {
    super("The library already holds an overview of this article");
    this.held = held;
  }
}
