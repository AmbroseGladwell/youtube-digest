import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFetchEventsApi, type EventsApi } from "@overview/sync";
import { useErrorReporter } from "../errors/ErrorReporterContext.js";
import {
  analyticsConsentSnapshot,
  forgetAnonymousId,
  mintAnonymousId,
  useAnalyticsConsent,
} from "../analyticsConsent/useAnalyticsConsent.js";
import { consentAllowsSharing } from "../analyticsConsent/util/consentAskOf.js";
import { useSettingsQuery } from "../settings/queries/settingsQuery.js";
import { useSync } from "../sync/SyncContext.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { AnalyticsProvider } from "./AnalyticsContext.js";
import { AnalyticsQueue } from "./AnalyticsQueue.js";
import { createAnalytics } from "./createAnalytics.js";
import { useAnalyticsContext } from "./useAnalyticsContext.js";
import { useClientSurface } from "../../app/SurfaceContext.js";

interface Sender {
  api: EventsApi;
  anonymousId?: string;
}

// Inside the sync runtime: a signed-in reader's usage goes over their own session unless
// their account turned sharing off, and a reader without an account's only once they have
// said yes, under the anonymous id that yes made (docs/architecture/analytics.md, "Who is
// counted").
export function AnalyticsRuntime({ children }: { children: ReactNode }) {
  const { connected } = useSync();
  const { apiUrl, token } = useSyncConnection().connection;
  const knownApiUrl = useKnownApiUrl();
  const surface = useClientSurface();
  const context = useAnalyticsContext();
  const errors = useErrorReporter();
  const { consent } = useAnalyticsConsent();
  const optedOut = useSettingsQuery().data?.analyticsOptOut ?? false;

  useEffect(() => {
    if (connected) forgetAnonymousId();
    else mintAnonymousId();
  }, [connected, consent]);

  const sessionApi = useMemo<EventsApi | null>(
    () => (connected && !optedOut && apiUrl !== null ? createFetchEventsApi({ baseUrl: apiUrl, token, surface }) : null),
    [connected, optedOut, apiUrl, token, surface],
  );
  const anonymousApi = useMemo<EventsApi | null>(
    () => (!connected && knownApiUrl !== null ? createFetchEventsApi({ baseUrl: knownApiUrl, token: null, surface }) : null),
    [connected, knownApiUrl, surface],
  );
  const latest = useRef({ signedIn: connected, sessionApi, anonymousApi, context });
  latest.current = { signedIn: connected, sessionApi, anonymousApi, context };

  const [queue] = useState(() => {
    const sender = (): Sender | null => {
      if (latest.current.signedIn) return latest.current.sessionApi === null ? null : { api: latest.current.sessionApi };
      const { consent: answered } = analyticsConsentSnapshot();
      const anonymousId = answered?.anonymousId ?? null;
      if (latest.current.anonymousApi === null || !consentAllowsSharing(answered) || anonymousId === null) return null;
      return { api: latest.current.anonymousApi, anonymousId };
    };
    return new AnalyticsQueue({
      canSend: () => sender() !== null,
      send: (batch, options) => {
        const { api, anonymousId } = sender()!;
        return api.send(
          { context: latest.current.context, ...batch, ...(anonymousId === undefined ? {} : { anonymousId }) },
          options,
        );
      },
    });
  });

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
