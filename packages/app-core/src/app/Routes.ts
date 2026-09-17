import type { OverviewId } from "@overview/types";

// The single place that knows every path this app has (docs/conventions/frontend-architecture-guide.md
// 1.2). Call sites (navigate(), <Link>, tests) go through this rather than a string
// literal, so adding more routes later doesn't mean hunting down inlined paths.
export const Routes = {
  home: () => "/",
  settings: () => "/settings",
  overview: (overviewId: OverviewId | string) => `/overviews/${overviewId}`,
};

export const RouteParams = {
  overviewId: "overviewId",
} as const;
