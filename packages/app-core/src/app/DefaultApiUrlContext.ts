import { createContext, useContext } from "react";

// Null in the web app, which is on the server's own origin; a server named in Settings still wins.
const DefaultApiUrlContext = createContext<string | null>(null);

export const DefaultApiUrlProvider = DefaultApiUrlContext.Provider;

export const useDefaultApiUrl = (): string | null => {
  return useContext(DefaultApiUrlContext);
};
