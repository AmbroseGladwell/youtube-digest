import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFetchEventsApi, type EventsApi } from "@overview/sync";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { AnalyticsProvider } from "./AnalyticsContext.js";
import { AnalyticsQueue } from "./AnalyticsQueue.js";
import { createAnalytics } from "./createAnalytics.js";
import { useAnalyticsContext } from "./useAnalyticsContext.js";
import { useClientSurface } from "../../app/SurfaceContext.js";

// Inside the sync runtime, because only a signed-in reader's usage is sent, over their own
// session (docs/architecture/analytics.md, "Who is counted").
export function AnalyticsRuntime({ children }: { children: ReactNode }) {
  const { connected } = useSync();
  const { apiUrl, token } = useSyncConnection().connection;
  const surface = useClientSurface();
  const context = useAnalyticsContext();
  const errors = useErrorReporter();

  const api = useMemo<EventsApi | null>(
    () => (connected && apiUrl !== null ? createFetchEventsApi({ baseUrl: apiUrl, token, surface }) : null),
    [connected, apiUrl, token, surface],
  );
  const latest = useRef({ api, context });
  latest.current = { api, context };

  const [queue] = useState(
    () =>
      new AnalyticsQueue({
        canSend: () => latest.current.api !== null,
        send: (batch, options) => latest.current.api!.send({ context: latest.current.context, ...batch }, options),
      }),
  );

  useEffect(() => {
    const flushErrorsThenEvents = () => {
      void errors.flush({ keepalive: true });
      void queue.flush({ keepalive: true });
    };
    const flushOnHide = () => {
      if (document.visibilityState === "hidden") flushErrorsThenEvents();
    };
    const flushOnLeave = flushErrorsThenEvents;
    document.addEventListener("visibilitychange", flushOnHide);
    globalThis.addEventListener("pagehide", flushOnLeave);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHide);
      globalThis.removeEventListener("pagehide", flushOnLeave);
    };
  }, [queue, errors]);

  useEffect(() => () => queue.dispose(), [queue]);

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
  return <AnalyticsProvider value={analytics}>{children}</AnalyticsProvider>;
}
