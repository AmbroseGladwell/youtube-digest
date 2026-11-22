import { useState } from "react";
import { useIsPanel } from "../app/LayoutContext.js";
import { useClientSurface } from "../app/SurfaceContext.js";
import { isDesktopChrome } from "./isDesktopChrome.js";

// Offered only where it can be added: the web app in desktop Chrome.
export const useExtensionOffered = (): boolean => {
  const isPanel = useIsPanel();
  const surface = useClientSurface();
  const [desktopChrome] = useState(() => isDesktopChrome());
  return desktopChrome && !isPanel && surface !== "extension";
};
