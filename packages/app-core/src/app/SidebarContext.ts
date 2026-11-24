import { createContext, useContext } from "react";

// Whether the shell's sidebar is on screen, so a page shows what it holds elsewhere when it isn't.
const SidebarContext = createContext(false);

export const SidebarShownProvider = SidebarContext.Provider;

export const useSidebarShown = (): boolean => {
  return useContext(SidebarContext);
};
