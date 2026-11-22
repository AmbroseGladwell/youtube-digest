import { useEffect } from "react";
import type { ClientErrorSource } from "@overview/domain";
import { useErrorReporter } from "./ErrorReporterContext.js";

export const useReportError = (error: unknown, source: ClientErrorSource, { handled = true } = {}): void => {
  const reporter = useErrorReporter();
  useEffect(() => {
    if (error !== undefined && error !== null) {
      reporter.report(error, source, { handled });
    }
  }, [reporter, error, source, handled]);
};
