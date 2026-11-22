import { createContext, useContext } from "react";

export interface ErrorDestination {
  apiUrl: string | null;
  token: string | null;
}

// Why the service worker needs this: docs/architecture/errors-and-logs.md, "The service worker".
export type ErrorDestinationMirror = (destination: ErrorDestination) => void;

const ErrorDestinationMirrorContext = createContext<ErrorDestinationMirror | null>(null);

export const ErrorDestinationMirrorProvider = ErrorDestinationMirrorContext.Provider;

export const useErrorDestinationMirror = (): ErrorDestinationMirror | null => {
  return useContext(ErrorDestinationMirrorContext);
};
