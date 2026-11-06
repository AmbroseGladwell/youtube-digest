import type { ActivePage } from "./ArticlePagesContext.js";

// A site's front page is a list of other stories. We can't look before Create, so its address
// is what tells us; anything subtler is found out by reading (design 77ak).
export const isOfferedPage = (page: ActivePage | null): page is ActivePage =>
  page !== null && new URL(page.url).pathname !== "/";
