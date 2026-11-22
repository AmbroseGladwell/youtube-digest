import { createContext, useContext } from "react";

export type AppLayout = "full" | "panel";

// Apart from Surface: the extension's two documents are both its own library, but only one is the panel.
const LayoutContext = createContext<AppLayout>("full");

export const LayoutProvider = LayoutContext.Provider;

export const useLayout = (): AppLayout => {
  return useContext(LayoutContext);
};

export const useIsPanel = (): boolean => {
  return useLayout() === "panel";
};
