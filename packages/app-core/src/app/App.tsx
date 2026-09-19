import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { StoresProvider, type Stores } from "../stores/StoresContext.js";
import { queryClient } from "./queryClient.js";
import { ActiveVideoProvider, type ActiveVideoSource } from "./ActiveVideoContext.js";
import { SurfaceProvider, type Surface } from "./SurfaceContext.js";
import type { AppRouter } from "./createAppRouter.js";
import "../theme/global.scss";

export interface AppProps {
  stores: Stores;
  router: AppRouter;
  surface: Surface;
  activeVideo?: ActiveVideoSource | null;
}

export function App({ stores, router, surface, activeVideo = null }: AppProps) {
  return (
    <ActiveVideoProvider value={activeVideo}>
      <SurfaceProvider value={surface}>
        <StoresProvider value={stores}>
          <QueryClientProvider client={queryClient}>
            <RouterProvider router={router} />
          </QueryClientProvider>
        </StoresProvider>
      </SurfaceProvider>
    </ActiveVideoProvider>
  );
}
