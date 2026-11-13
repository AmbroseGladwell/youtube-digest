import {
  consentPath,
  CREATE_ACCOUNT_PATH,
  REVERT_EMAIL_PATH,
  SIGN_IN_PATH,
  sharePath,
  type OverviewId,
  type ProjectId,
  type ShareToken,
} from "@overview/domain";
import type { SettingsSectionId } from "../features/settings/SettingsSectionId.js";

// The single place that knows every path this app has (docs/conventions/frontend-architecture-guide.md
// 1.2). Call sites (navigate(), <Link>, tests) go through this rather than a string
// literal, so adding more routes later doesn't mean hunting down inlined paths.
export const Routes = {
  home: () => "/",
  // The library filtered to one tag, as a note's tags link to it ("OV-84 1 On the Note").
  taggedLibrary: (tag: string) => `/?${new URLSearchParams({ tag })}`,
  settings: () => "/settings",
  // The capture queue's own page (docs/features/capture-queue.md).
  queue: () => "/queue",
  settingsSection: (section: SettingsSectionId) => `/settings/${section}`,
  // The path the server writes into every magic link, so the two cannot drift apart.
  signIn: () => SIGN_IN_PATH,
  // The path the server writes into the mail an address with no account gets for asking to
  // sign in (docs/features/sign-in.md, "Which mail an address gets").
  createAccount: () => CREATE_ACCOUNT_PATH,
  // Onboarding's screens after Start, which is the home page's own field (docs/features/onboarding.md).
  onboarding: () => "/start",
  connectExtension: () => "/connect-extension",
  // The path the server writes into the old address's mail after an email change, so the
  // two cannot drift (docs/features/account-changes.md, "Moving it back").
  revertEmail: () => REVERT_EMAIL_PATH,
  connect: (requestId: string) => consentPath(requestId),
  // The two public pages every policy link points at, served to anyone, signed in or not
  // (docs/features/legal-pages.md).
  privacy: () => "/privacy",
  terms: () => "/terms",
  overview: (overviewId: OverviewId | string) => `/overviews/${overviewId}`,
  // Every project, then one project's page: the library's main column given over to it
  // (docs/features/projects.md, "The project page").
  projects: () => "/projects",
  project: (projectId: ProjectId | string) => `/projects/${projectId}`,
  // The address the API writes into every shared link, so the two cannot drift
  // (docs/features/sharing.md).
  sharedOverview: (token: ShareToken | string) => sharePath(token),
};

export const RouteParams = {
  overviewId: "overviewId",
  projectId: "projectId",
  requestId: "requestId",
  shareToken: "token",
} as const;
