import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AnalyticsContext } from "@overview/domain";
import { createFetchEventsApi, type EventsApi } from "@overview/sync";
import { useAppBuild } from "../../app/AppBuildContext.js";
import { useLayout } from "../../app/LayoutContext.js";
import { useSurface } from "../../app/SurfaceContext.js";
import { useSync } from "../sync/SyncContext.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { AnalyticsProvider } from "./AnalyticsContext.js";
import { AnalyticsQueue } from "./AnalyticsQueue.js";
import { createAnalytics } from "./createAnalytics.js";
import { analyticsPlatform } from "./util/analyticsPlatform.js";

const SEMVER = /^\d+\.\d+\.\d+$/;

// Inside the sync runtime, because only a signed-in reader's usage is sent, over their own
// session (docs/architecture/analytics.md, "Who is counted").
export function AnalyticsRuntime({ children }: { children: ReactNode }) {
  const { connected } = useSync();
  const { apiUrl, token } = useSyncConnection().connection;
  const surface = useSurface();
  const layout = useLayout();
  const build = useAppBuild();

  const api = useMemo<EventsApi | null>(
    () => (connected && apiUrl !== null ? createFetchEventsApi({ baseUrl: apiUrl, token }) : null),
    [connected, apiUrl, token],
  );
  const context = useMemo<AnalyticsContext>(
    () => ({
      surface,
      layout,
      appVersion: build !== null && SEMVER.test(build.version) ? build.version : null,
      platform: analyticsPlatform(globalThis.navigator),
    }),
    [surface, layout, build],
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
    const flushOnHide = () => {
      if (document.visibilityState === "hidden") void queue.flush({ keepalive: true });
    };
    const flushOnLeave = () => void queue.flush({ keepalive: true });
    document.addEventListener("visibilitychange", flushOnHide);
    globalThis.addEventListener("pagehide", flushOnLeave);
    return () => {
      document.removeEventListener("visibilitychange", flushOnHide);
      globalThis.removeEventListener("pagehide", flushOnLeave);
    };
  }, [queue]);

  useEffect(() => () => queue.dispose(), [queue]);

  const analytics = useMemo(() => createAnalytics(queue), [queue]);
  return <AnalyticsProvider value={analytics}>{children}</AnalyticsProvider>;
}
