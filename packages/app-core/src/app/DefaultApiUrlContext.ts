import { createContext, useContext } from "react";

// The server a shell was built to talk to, before the reader has named one: the extension
// is built for production and says so, the web app is on the server's own origin and
// needs nothing here. What the reader types in Settings still wins
// (docs/architecture/deploy.md, "The extension").
const DefaultApiUrlContext = createContext<string | null>(null);

export const DefaultApiUrlProvider = DefaultApiUrlContext.Provider;

export function useDefaultApiUrl(): string | null {
  return useContext(DefaultApiUrlContext);
}
