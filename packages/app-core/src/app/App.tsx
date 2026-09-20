import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { StoresProvider, type Stores } from "../stores/StoresContext.js";
import { queryClient } from "./queryClient.js";
import { ActiveVideoProvider, type ActiveVideoSource } from "./ActiveVideoContext.js";
import { LayoutProvider, type AppLayout } from "./LayoutContext.js";
import { PlaybackProvider, type PlaybackSource } from "./PlaybackContext.js";
import { RunBridgeProvider, type RunBridge } from "./RunBridgeContext.js";
import { SurfaceProvider, type Surface } from "./SurfaceContext.js";
import type { AppRouter } from "./createAppRouter.js";
import "../theme/global.scss";

export interface AppProps {
  stores: Stores;
  router: AppRouter;
  surface: Surface;
  layout?: AppLayout;
  activeVideo?: ActiveVideoSource | null;
  playback?: PlaybackSource | null;
  runBridge?: RunBridge | null;
}

export function App({
  stores,
  router,
  surface,
  layout = "full",
  activeVideo = null,
  playback = null,
  runBridge = null,
}: AppProps) {
  return (
    <ActiveVideoProvider value={activeVideo}>
      <PlaybackProvider value={playback}>
        <RunBridgeProvider value={runBridge}>
          <LayoutProvider value={layout}>
            <SurfaceProvider value={surface}>
              <StoresProvider value={stores}>
                <QueryClientProvider client={queryClient}>
                  <RouterProvider router={router} />
                </QueryClientProvider>
              </StoresProvider>
            </SurfaceProvider>
          </LayoutProvider>
        </RunBridgeProvider>
      </PlaybackProvider>
    </ActiveVideoProvider>
  );
}
