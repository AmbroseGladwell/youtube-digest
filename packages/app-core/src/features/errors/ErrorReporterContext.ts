import { createContext, useContext } from "react";
import type { AnalyticsEventName, ClientErrorSource, ClientTimingReport, ClientWarningReport } from "@overview/domain";
import type { SendOptions } from "../analytics/AnalyticsQueue.js";

export interface ErrorReporter {
  report(thrown: unknown, source: ClientErrorSource, options?: { handled?: boolean }): void;
  // Never an error-tracking issue: docs/architecture/errors-and-logs.md, "Client warnings".
  warn(warning: ClientWarningReport): void;
  // Never an event: docs/architecture/errors-and-logs.md, "Client timings".
  time(timing: ClientTimingReport): void;
  recordAction(name: AnalyticsEventName): void;
  flush(options?: SendOptions): Promise<void>;
}

export const silentErrorReporter: ErrorReporter = {
  report: () => undefined,
  warn: () => undefined,
  time: () => undefined,
  recordAction: () => undefined,
  flush: async () => undefined,
};

const ErrorReporterContext = createContext<ErrorReporter>(silentErrorReporter);

export const ErrorReporterProvider = ErrorReporterContext.Provider;

export const useErrorReporter = (): ErrorReporter => {
  return useContext(ErrorReporterContext);
};
