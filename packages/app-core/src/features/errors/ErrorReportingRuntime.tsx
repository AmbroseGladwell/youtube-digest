import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFetchErrorsApi, toClientError, type ErrorsApi } from "@overview/sync";
import { useErrorDestinationMirror } from "../../app/ErrorDestinationMirrorContext.js";
import { useAnalyticsContext } from "../analytics/useAnalyticsContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { ActionTrail } from "./ActionTrail.js";
import { ErrorQueue } from "./ErrorQueue.js";
import { ErrorReporterProvider, type ErrorReporter } from "./ErrorReporterContext.js";

// Signed in or not: an error is reported to the server this shell knows, under the session
// when there is one (docs/architecture/errors-and-logs.md, "Who is reported").
export function ErrorReportingRuntime({ children }: { children: ReactNode }) {
  const apiUrl = useKnownApiUrl();
  const { token } = useSyncConnection().connection;
  const context = useAnalyticsContext();
  const mirror = useErrorDestinationMirror();

  const api = useMemo<ErrorsApi | null>(
    () => (apiUrl === null ? null : createFetchErrorsApi({ baseUrl: apiUrl, token })),
    [apiUrl, token],
  );
  const latest = useRef({ api, context });
  latest.current = { api, context };

  const [trail] = useState(() => new ActionTrail());
  const [queue] = useState(
    () =>
      new ErrorQueue({
        canSend: () => latest.current.api !== null,
        send: (batch, options) => latest.current.api!.send({ context: latest.current.context, ...batch }, options),
      }),
  );

  const reporter = useMemo<ErrorReporter>(() => {
    const reported = new WeakSet<object>();
    return {
      report: (thrown, source, { handled = false } = {}) => {
        if (typeof thrown === "object" && thrown !== null) {
          if (reported.has(thrown)) return;
          reported.add(thrown);
        }
        queue.record(toClientError(thrown, { source, handled, trail: trail.entries(), at: new Date() }));
      },
      recordAction: (name) => trail.record(name),
      flush: (options) => queue.flush(options),
    };
  }, [queue, trail]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => reporter.report(event.error ?? event.message, "uncaught");
    const onRejection = (event: PromiseRejectionEvent) => reporter.report(event.reason, "unhandledRejection");
    const flushOnHide = () => {
      if (document.visibilityState === "hidden") void queue.flush({ keepalive: true });
    };
    const flushOnLeave = () => void queue.flush({ keepalive: true });
    globalThis.addEventListener("error", onError);
    globalThis.addEventListener("unhandledrejection", onRejection);
    document.addEventListener("visibilitychange", flushOnHide);
    globalThis.addEventListener("pagehide", flushOnLeave);
    return () => {
      globalThis.removeEventListener("error", onError);
      globalThis.removeEventListener("unhandledrejection", onRejection);
      document.removeEventListener("visibilitychange", flushOnHide);
      globalThis.removeEventListener("pagehide", flushOnLeave);
    };
  }, [reporter, queue]);

  useEffect(() => mirror?.({ apiUrl, token }), [mirror, apiUrl, token]);

  useEffect(() => () => queue.dispose(), [queue]);

  return <ErrorReporterProvider value={reporter}>{children}</ErrorReporterProvider>;
}
