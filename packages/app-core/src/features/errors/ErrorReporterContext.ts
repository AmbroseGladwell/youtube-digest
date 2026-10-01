import { createContext, useContext } from "react";
import type { AnalyticsEventName, ClientErrorSource } from "@overview/domain";
import type { SendOptions } from "../analytics/AnalyticsQueue.js";

export interface ErrorReporter {
  report(thrown: unknown, source: ClientErrorSource, options?: { handled?: boolean }): void;
  recordAction(name: AnalyticsEventName): void;
  flush(options?: SendOptions): Promise<void>;
}

export const silentErrorReporter: ErrorReporter = {
  report: () => undefined,
  recordAction: () => undefined,
  flush: async () => undefined,
};

const ErrorReporterContext = createContext<ErrorReporter>(silentErrorReporter);

export const ErrorReporterProvider = ErrorReporterContext.Provider;

export function useErrorReporter(): ErrorReporter {
  return useContext(ErrorReporterContext);
}
