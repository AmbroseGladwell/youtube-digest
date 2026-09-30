import type { createBrowserRouter } from "react-router";
import { AppShell } from "../shell/AppShell/AppShell.js";
import { HomePage } from "../features/home/HomePage/HomePage.js";
import { ReaderPage } from "../features/reader/ReaderPage/ReaderPage.js";
import { SettingsPage } from "../features/settings/SettingsPage/SettingsPage.js";
import { SETTINGS_SECTION_IDS } from "../features/settings/SettingsSectionId.js";
import { ConnectExtensionPage } from "../features/auth/ConnectExtensionPage/ConnectExtensionPage.js";
import { CreateAccountPage } from "../features/auth/CreateAccountPage/CreateAccountPage.js";
import { SignInPage } from "../features/auth/SignInPage/SignInPage.js";
import { SharedOverviewRoute } from "../features/sharedPage/SharedOverviewRoute.js";
import { ErrorState } from "../components/shared/ErrorState/ErrorState.js";
import { RouterErrorBoundary } from "./RouterErrorBoundary.js";
import { RouteParams, Routes } from "./Routes.js";

export type RouterFactory = typeof createBrowserRouter;

export type AppRouter = ReturnType<RouterFactory>;

// The history is the mounting shell's choice, the same way the stores are: the web app has
// real paths to push, an extension page at chrome-extension://<id>/sidepanel.html does not
// (docs/architecture/v1-architecture-decisions.md's one-core-two-shells model).
export function createAppRouter(createRouter: RouterFactory): AppRouter {
  return createRouter([
    // Outside the shell: a visitor opening a shared link has no library behind them, so
    // the page brings its own head (docs/features/sharing.md).
    {
      path: Routes.sharedOverview(`:${RouteParams.shareToken}`),
      element: <SharedOverviewRoute />,
      errorElement: <RouterErrorBoundary />,
    },
    {
      element: <AppShell />,
      errorElement: <RouterErrorBoundary />,
      children: [
        { path: Routes.home(), element: <HomePage /> },
        { path: Routes.overview(`:${RouteParams.overviewId}`), element: <ReaderPage /> },
        { path: Routes.settings(), element: <SettingsPage /> },
        ...SETTINGS_SECTION_IDS.map((section) => ({
          path: Routes.settingsSection(section),
          element: <SettingsPage section={section} />,
        })),
        { path: Routes.signIn(), element: <SignInPage /> },
        { path: Routes.createAccount(), element: <CreateAccountPage /> },
        { path: Routes.connectExtension(), element: <ConnectExtensionPage /> },
        { path: "*", element: <ErrorState title="There's nothing at this address" back /> },
      ],
    },
  ]);
}
