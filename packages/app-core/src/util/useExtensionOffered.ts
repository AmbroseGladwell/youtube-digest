import { useState } from "react";
import { useIsPanel } from "../app/LayoutContext.js";
import { useClientSurface } from "../app/SurfaceContext.js";
import { isDesktopChrome } from "./isDesktopChrome.js";

// The Chrome extension is offered only where it can be added: the web app in desktop Chrome.
// Never on a phone, in another browser, or in the extension itself (its panel or its tab).
export function useExtensionOffered(): boolean {
  const isPanel = useIsPanel();
  const surface = useClientSurface();
  const [desktopChrome] = useState(() => isDesktopChrome());
  return desktopChrome && !isPanel && surface !== "extension";
}
