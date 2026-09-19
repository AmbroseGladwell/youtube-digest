import { createContext, useContext } from "react";

export type AppLayout = "full" | "panel";

// Which shape of app the mounting shell asked for, alongside which stores and which
// history it handed over. The side panel is 400px of chrome beside a video and shows the
// one video it is beside; the web app and the extension's own full page are a library
// (docs/features/extension-panel.md).
//
// A second axis from Surface rather than a third value on it: the extension has two
// documents, and both are the extension's own library while only one of them is the
// panel.
const LayoutContext = createContext<AppLayout>("full");

export const LayoutProvider = LayoutContext.Provider;

export function useLayout(): AppLayout {
  return useContext(LayoutContext);
}

export function useIsPanel(): boolean {
  return useLayout() === "panel";
}
