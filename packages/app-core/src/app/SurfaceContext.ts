import { createContext, useContext } from "react";

export type Surface = "web" | "extension";

// Copy differs per shell, because storage is partitioned by origin, and app-core can't read chrome.*.
const SurfaceContext = createContext<Surface | null>(null);

export const SurfaceProvider = SurfaceContext.Provider;

// For what only reports the surface, such as API calls tagging the server's logs: they work without it.
export const useClientSurface = (): Surface | undefined => {
  return useContext(SurfaceContext) ?? undefined;
};

export const useSurface = (): Surface => {
  const surface = useContext(SurfaceContext);
  if (!surface) {
    throw new Error("useSurface must be used within a SurfaceProvider");
  }
  return surface;
};
