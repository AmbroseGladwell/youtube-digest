import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import type { YouTubeFetch } from "@overview/transcripts";
import { LibraryMoveRuntime } from "../features/accountLibraries/LibraryMoveRuntime.js";
import { AnalyticsRuntime } from "../features/analytics/AnalyticsRuntime.js";
import { ErrorReportingRuntime } from "../features/errors/ErrorReportingRuntime.js";
import { PlayerRuntime } from "../features/player/PlayerRuntime.js";
import { ShareRuntime } from "../features/shares/ShareRuntime.js";
import { SyncRuntime } from "../features/sync/SyncRuntime.js";
import type { Library, OpenLibrary } from "../stores/Library.js";
import { LibraryRuntime } from "../stores/LibraryRuntime.js";
import { AppBuildProvider, type AppBuild } from "./AppBuildContext.js";
import { AppUpdateProvider, type AppUpdate } from "./AppUpdateContext.js";
import { DefaultApiUrlProvider } from "./DefaultApiUrlContext.js";
import { ErrorDestinationMirrorProvider, type ErrorDestinationMirror } from "./ErrorDestinationMirrorContext.js";
import { queryClient } from "./queryClient.js";
import { ActiveVideoProvider, type ActiveVideoSource } from "./ActiveVideoContext.js";
import { LayoutProvider, type AppLayout } from "./LayoutContext.js";
import { PlaybackProvider, type PlaybackSource } from "./PlaybackContext.js";
import { RunBridgeProvider, type RunBridge } from "./RunBridgeContext.js";
import { SurfaceProvider, type Surface } from "./SurfaceContext.js";
import { YouTubeFetchProvider } from "./YouTubeFetchContext.js";
import type { AppRouter } from "./createAppRouter.js";
import "../theme/global.scss";

export interface AppProps {
  library: Library;
  openLibrary: OpenLibrary;
  router: AppRouter;
  surface: Surface;
  layout?: AppLayout;
  activeVideo?: ActiveVideoSource | null;
  playback?: PlaybackSource | null;
  runBridge?: RunBridge | null;
  youTubeFetch?: YouTubeFetch | null;
  appUpdate?: AppUpdate | null;
  defaultApiUrl?: string | null;
  build?: AppBuild | null;
  errorDestinationMirror?: ErrorDestinationMirror | null;
}

export function App({
  library,
  openLibrary,
  router,
  surface,
  layout = "full",
  activeVideo = null,
  playback = null,
  runBridge = null,
  youTubeFetch = null,
  appUpdate = null,
  defaultApiUrl = null,
  build = null,
  errorDestinationMirror = null,
}: AppProps) {
  return (
    <YouTubeFetchProvider value={youTubeFetch}>
      <ActiveVideoProvider value={activeVideo}>
        <PlaybackProvider value={playback}>
          <RunBridgeProvider value={runBridge}>
            <LayoutProvider value={layout}>
              <SurfaceProvider value={surface}>
                <AppUpdateProvider value={appUpdate}>
                  <DefaultApiUrlProvider value={defaultApiUrl}>
                    <ErrorDestinationMirrorProvider value={errorDestinationMirror}>
                      <AppBuildProvider value={build}>
                        <QueryClientProvider client={queryClient}>
                          <LibraryRuntime library={library} openLibrary={openLibrary}>
                            <SyncRuntime>
                              <ErrorReportingRuntime>
                                <AnalyticsRuntime>
                                  <LibraryMoveRuntime>
                                    <PlayerRuntime>
                                      <ShareRuntime>
                                        <RouterProvider router={router} />
                                      </ShareRuntime>
                                    </PlayerRuntime>
                                  </LibraryMoveRuntime>
                                </AnalyticsRuntime>
                              </ErrorReportingRuntime>
                            </SyncRuntime>
                          </LibraryRuntime>
                        </QueryClientProvider>
                      </AppBuildProvider>
                    </ErrorDestinationMirrorProvider>
                  </DefaultApiUrlProvider>
                </AppUpdateProvider>
              </SurfaceProvider>
            </LayoutProvider>
          </RunBridgeProvider>
        </PlaybackProvider>
      </ActiveVideoProvider>
    </YouTubeFetchProvider>
  );
}
