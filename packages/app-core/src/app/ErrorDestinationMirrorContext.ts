import { createContext, useContext } from "react";

export interface ErrorDestination {
  apiUrl: string | null;
  token: string | null;
}

// Hands where errors go, and under which session, to a part of the shell the app doesn't
// run in: the extension's service worker, which can't read the page's storage
// (docs/architecture/errors-and-logs.md, "The service worker"). The web app has none.
export type ErrorDestinationMirror = (destination: ErrorDestination) => void;

const ErrorDestinationMirrorContext = createContext<ErrorDestinationMirror | null>(null);

export const ErrorDestinationMirrorProvider = ErrorDestinationMirrorContext.Provider;

export function useErrorDestinationMirror(): ErrorDestinationMirror | null {
  return useContext(ErrorDestinationMirrorContext);
}
