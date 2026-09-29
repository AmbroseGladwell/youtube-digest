import { SIGN_IN_PATH, type OverviewId } from "@overview/domain";

// The single place that knows every path this app has (docs/conventions/frontend-architecture-guide.md
// 1.2). Call sites (navigate(), <Link>, tests) go through this rather than a string
// literal, so adding more routes later doesn't mean hunting down inlined paths.
// The id Settings puts on its sync section, so the bar's Sign in can land there until it
// has a sign-in of its own (docs/features/stone-theme.md, "Placed but not wired").
export const SETTINGS_SYNC_ANCHOR = "sync";

export const Routes = {
  home: () => "/",
  settings: () => "/settings",
  settingsSync: () => `/settings#${SETTINGS_SYNC_ANCHOR}`,
  // The path the server writes into every magic link, so the two cannot drift apart.
  signIn: () => SIGN_IN_PATH,
  overview: (overviewId: OverviewId | string) => `/overviews/${overviewId}`,
};

export const RouteParams = {
  overviewId: "overviewId",
} as const;
