import { SIGN_IN_PATH, type OverviewId } from "@overview/domain";

// The single place that knows every path this app has (docs/conventions/frontend-architecture-guide.md
// 1.2). Call sites (navigate(), <Link>, tests) go through this rather than a string
// literal, so adding more routes later doesn't mean hunting down inlined paths.
export const Routes = {
  home: () => "/",
  settings: () => "/settings",
  // The path the server writes into every magic link, so the two cannot drift apart.
  signIn: () => SIGN_IN_PATH,
  createAccount: () => "/create-account",
  overview: (overviewId: OverviewId | string) => `/overviews/${overviewId}`,
};

export const RouteParams = {
  overviewId: "overviewId",
} as const;
