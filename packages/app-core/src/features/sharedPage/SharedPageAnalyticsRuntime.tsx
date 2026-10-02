import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFetchSharedPageEventsApi } from "@overview/sync";
import { AnalyticsProvider } from "../analytics/AnalyticsContext.js";
import { AnalyticsQueue } from "../analytics/AnalyticsQueue.js";
import { createAnalytics } from "../analytics/createAnalytics.js";
import { OverviewAnalyticsProvider } from "../analytics/OverviewAnalyticsContext.js";
import { useAnalyticsContext } from "../analytics/useAnalyticsContext.js";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";

// A shared link counts what its visitors do, account or not, against the share's own route
// rather than the reader's session; the page load's id lives in memory and nowhere else
// (docs/architecture/analytics.md, "The shared page").
export function SharedPageAnalyticsRuntime({ token, children }: { token: string; children: ReactNode }) {
  const context = useAnalyticsContext();
  const errors = useErrorReporter();
  const [viewId] = useState(() => globalThis.crypto.randomUUID());
  const latest = useRef(context);
  latest.current = context;

  const [queue] = useState(() => {
    const api = createFetchSharedPageEventsApi({ baseUrl: globalThis.location.origin, token });
    return new AnalyticsQueue({
      canSend: () => true,
      send: (batch, options) => api.send({ context: latest.current, viewId, ...batch }, options),
    });
  });

  useEffect(() => {
    const flushOnHide = () => {
      if (document.visibilityState === "hidden") void queue.flush({ keepalive: true });
    };
    const flushOnLeave = () => void queue.flush({ keepalive: true });
    document.addEventListener("visibilitychange", flushOnHide);
    globalThis.addEventListener("pagehide", flushOnLeave);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHide);
      globalThis.removeEventListener("pagehide", flushOnLeave);
      void queue.flush({ keepalive: true });
    };
  }, [queue]);

  const analytics = useMemo(
    () =>
      createAnalytics({
        record: (name, props) => {
          errors.recordAction(name);
          queue.record(name, props);
        },
        flush: (options) => queue.flush(options),
      }),
    [queue, errors],
  );
  const overviewAnalytics = useMemo(() => ({ page: analytics.sharedPage, reader: null }), [analytics]);

  return (
    <AnalyticsProvider value={analytics}>
      <OverviewAnalyticsProvider value={overviewAnalytics}>{children}</OverviewAnalyticsProvider>
    </AnalyticsProvider>
  );
}
