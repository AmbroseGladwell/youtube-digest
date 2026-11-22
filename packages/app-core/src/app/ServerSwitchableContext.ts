import { createContext, useContext } from "react";

// True by default, so only a shell that knows it is a Web Store build turns server switching off.
const ServerSwitchableContext = createContext<boolean>(true);

export const ServerSwitchableProvider = ServerSwitchableContext.Provider;

export const useServerSwitchable = (): boolean => {
  return useContext(ServerSwitchableContext);
};
