import { createBrowserRouter } from "react-router";
import { AppShell } from "../shell/AppShell/AppShell.js";
import { HomePage } from "../features/home/HomePage/HomePage.js";
import { ReaderPage } from "../features/reader/ReaderPage/ReaderPage.js";
import { SettingsPage } from "../features/settings/SettingsPage/SettingsPage.js";
import { RouterErrorBoundary } from "./RouterErrorBoundary.js";
import { RouteParams, Routes } from "./Routes.js";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    errorElement: <RouterErrorBoundary />,
    children: [
      { path: Routes.home(), element: <HomePage /> },
      { path: Routes.overview(`:${RouteParams.overviewId}`), element: <ReaderPage /> },
      { path: Routes.settings(), element: <SettingsPage /> },
    ],
  },
]);
