import { createContext, useContext } from "react";
import type { AnalyticsEventName, ClientErrorSource, ClientTimingReport, ClientWarningReport } from "@overview/domain";
import type { SendOptions } from "../analytics/AnalyticsQueue.js";

export interface ErrorReporter {
  report(thrown: unknown, source: ClientErrorSource, options?: { handled?: boolean }): void;
  // Something the app depends on let it down and it carried on: logged by the server at
  // warn, never an error-tracking issue (docs/architecture/errors-and-logs.md, "Client warnings").
  warn(warning: ClientWarningReport): void;
  // How the time went for something the app did: logged by the server at info, never an
  // event (docs/architecture/errors-and-logs.md, "Client timings").
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

export function useErrorReporter(): ErrorReporter {
  return useContext(ErrorReporterContext);
}
