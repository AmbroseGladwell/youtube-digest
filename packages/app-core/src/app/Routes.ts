import { consentPath, SIGN_IN_PATH, sharePath, type OverviewId, type ShareToken } from "@overview/domain";
import type { SettingsSectionId } from "../features/settings/SettingsSectionId.js";

// The single place that knows every path this app has (docs/conventions/frontend-architecture-guide.md
// 1.2). Call sites (navigate(), <Link>, tests) go through this rather than a string
// literal, so adding more routes later doesn't mean hunting down inlined paths.
export const Routes = {
  home: () => "/",
  settings: () => "/settings",
  settingsSection: (section: SettingsSectionId) => `/settings/${section}`,
  // The path the server writes into every magic link, so the two cannot drift apart.
  signIn: () => SIGN_IN_PATH,
  createAccount: () => "/create-account",
  connectExtension: () => "/connect-extension",
  connect: (requestId: string) => consentPath(requestId),
  overview: (overviewId: OverviewId | string) => `/overviews/${overviewId}`,
  // The address the API writes into every shared link, so the two cannot drift
  // (docs/features/sharing.md).
  sharedOverview: (token: ShareToken | string) => sharePath(token),
};

export const RouteParams = {
  overviewId: "overviewId",
  requestId: "requestId",
  shareToken: "token",
} as const;
