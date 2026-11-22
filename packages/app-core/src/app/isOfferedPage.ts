import type { ActivePage } from "./ArticlePagesContext.js";

// A front page lists other stories; nothing is read before Create, so only its address can tell us.
export const isOfferedPage = (page: ActivePage | null): page is ActivePage => page !== null && new URL(page.url).pathname !== "/";
