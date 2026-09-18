import { createContext, useContext } from "react";

export type Surface = "web" | "extension";

// Storage is partitioned by origin, so the extension's library and the web app's are two
// separate libraries and always will be until an account syncs them
// (docs/architecture/architecture-options.md §5). The copy that says so has to differ per
// shell, and app-core can't read chrome.* to work out which it is in.
const SurfaceContext = createContext<Surface | null>(null);

export const SurfaceProvider = SurfaceContext.Provider;

export function useSurface(): Surface {
  const surface = useContext(SurfaceContext);
  if (!surface) {
    throw new Error("useSurface must be used within a SurfaceProvider");
  }
  return surface;
}
