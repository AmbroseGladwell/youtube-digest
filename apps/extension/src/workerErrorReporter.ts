import { analyticsPlatform, type AnalyticsContext } from "@overview/domain";
import { createFetchErrorsApi, toClientError, type ErrorsApi } from "@overview/sync";
import type { ErrorDestination } from "@overview/app-core";

export interface WorkerErrorReporterOptions {
  readDestination: () => Promise<ErrorDestination | null>;
  defaultApiUrl: string;
  appVersion: string | null;
  createApi?: (destination: { apiUrl: string; token: string | null }) => ErrorsApi;
  now?: () => Date;
  maxPerMinute?: number;
}

export interface WorkerErrorReporter {
  report(thrown: unknown, options?: { handled?: boolean }): Promise<void>;
}

const MINUTE_MS = 60 * 1000;
const SEMVER = /^\d+\.\d+\.\d+$/;

// The worker can be stopped between any two messages, so each error is sent the moment it
// is caught, on its own and with keepalive, rather than held for a batch
// (docs/architecture/errors-and-logs.md, "The service worker").
export function createWorkerErrorReporter({
  readDestination,
  defaultApiUrl,
  appVersion,
  createApi = ({ apiUrl, token }) => createFetchErrorsApi({ baseUrl: apiUrl, token, surface: "extension" }),
  now = () => new Date(),
  maxPerMinute = 10,
}: WorkerErrorReporterOptions): WorkerErrorReporter {
  const context: AnalyticsContext = {
    surface: "extension",
    layout: "worker",
    appVersion: appVersion !== null && SEMVER.test(appVersion) ? appVersion : null,
    platform: analyticsPlatform(globalThis.navigator),
  };
  let minuteStartedAt = Number.NEGATIVE_INFINITY;
  let inMinute = 0;
  let dropped = 0;

  return {
    report: async (thrown, { handled = false } = {}) => {
      const at = now();
      if (at.getTime() - minuteStartedAt >= MINUTE_MS) {
        minuteStartedAt = at.getTime();
        inMinute = 0;
      }
      if (inMinute >= maxPerMinute) {
        dropped += 1;
        return;
      }
      inMinute += 1;
      const error = toClientError(thrown, { source: "serviceWorker", handled, trail: [], at });
      const destination = await readDestination();
      const api = createApi({ apiUrl: destination?.apiUrl ?? defaultApiUrl, token: destination?.token ?? null });
      const lost = dropped;
      dropped = 0;
      try {
        await api.send({ context, errors: [error], ...(lost === 0 ? {} : { dropped: lost }) }, { keepalive: true });
      } catch {
        dropped += lost + 1;
      }
    },
  };
}
