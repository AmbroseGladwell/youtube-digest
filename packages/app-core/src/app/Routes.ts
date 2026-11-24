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

export interface AskRouteTarget {
  project?: ProjectId | string | null;
  chat?: string | null;
}

// Why every path lives here: docs/conventions/frontend-architecture-guide.md, "1.2 Never hardcode routes".
export const Routes = {
  home: () => "/",
  taggedLibrary: (tag: string) => `/?${new URLSearchParams({ tag })}`,
  libraryView: (params: URLSearchParams) => (params.size === 0 ? "/" : `/?${params}`),
  settings: () => "/settings",
  queue: () => "/queue",
  settingsSection: (section: SettingsSectionId) => `/settings/${section}`,
  // Shared with the server, which writes it into every magic link, so the two cannot drift apart.
  signIn: () => SIGN_IN_PATH,
  // Why shared with the server: docs/features/sign-in.md, "Which mail an address gets".
  createAccount: () => CREATE_ACCOUNT_PATH,
  // Onboarding's screens after Start, which is the home page's own field.
  onboarding: () => "/start",
  connectExtension: () => "/connect-extension",
  // Shared with the server's mail to the old address after an email change, so the two cannot drift.
  revertEmail: () => REVERT_EMAIL_PATH,
  connect: (requestId: string) => consentPath(requestId),
  privacy: () => "/privacy",
  terms: () => "/terms",
  overview: (overviewId: OverviewId | string) => `/overviews/${overviewId}`,
  projects: () => "/projects",
  project: (projectId: ProjectId | string) => `/projects/${projectId}`,
  ask: (at: AskRouteTarget = {}) => {
    const query = new URLSearchParams();
    if (at.project) {
      query.set("project", at.project);
    }
    if (at.chat) {
      query.set("chat", at.chat);
    }
    return query.size === 0 ? "/ask" : `/ask?${query}`;
  },
  // Shared with the API, which writes it into every shared link, so the two cannot drift.
  sharedOverview: (token: ShareToken | string) => sharePath(token),
};

export const RouteParams = {
  overviewId: "overviewId",
  projectId: "projectId",
  requestId: "requestId",
  shareToken: "token",
} as const;
