import type { HeldOverview } from "@overview/domain";

// Known only once the page is read: two addresses can name one article, and its canonical
// address is on the page (docs/features/article-panel.md).
export class ArticleAlreadyHeldError extends Error {
  readonly held: HeldOverview;

  constructor(held: HeldOverview) {
    super("The library already holds an overview of this article");
    this.held = held;
  }
}
