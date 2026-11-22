import { analyticsPlatform, type AnalyticsContext } from "@overview/domain";
import { createFetchErrorsApi, toClientError, type ErrorsApi } from "@overview/sync";
import { readSyncConnection } from "../features/sync/syncConnectionStorage.js";
import type { AppBuild } from "./AppBuildContext.js";
import type { AppLayout } from "./LayoutContext.js";
import type { Surface } from "./SurfaceContext.js";

export interface ApiDestinationOptions {
  apiUrl: string;
  token: string | null;
}

export interface ReportStartupFailureOptions {
  surface: Surface;
  layout?: AppLayout;
  build: AppBuild | null;
  defaultApiUrl?: string | null;
  storage?: Storage;
  createApi?: (destination: ApiDestinationOptions) => ErrorsApi;
  now?: () => Date;
}

const SEMVER = /^\d+\.\d+\.\d+$/;

// Why it bypasses the reporter: docs/architecture/errors-and-logs.md, "Before the app mounts".
export const reportStartupFailure = async (
  thrown: unknown,
  {
    surface,
    layout = "full",
    build,
    defaultApiUrl = null,
    storage = globalThis.localStorage,
    createApi = ({ apiUrl, token }) => createFetchErrorsApi({ baseUrl: apiUrl, token, surface }),
    now = () => new Date(),
  }: ReportStartupFailureOptions,
): Promise<void> => {
  try {
    const connection = readSyncConnection(storage);
    const apiUrl = surface === "extension" ? (connection.apiUrl ?? defaultApiUrl) : (globalThis.location?.origin ?? null);
    if (apiUrl === null) {
      return;
    }
    const context: AnalyticsContext = {
      surface,
      layout,
      appVersion: build !== null && SEMVER.test(build.version) ? build.version : null,
      platform: analyticsPlatform(globalThis.navigator),
    };
    const error = toClientError(thrown, { source: "startup", handled: true, trail: [], at: now() });
    await createApi({ apiUrl, token: connection.token }).send({ context, errors: [error] }, { keepalive: true });
  } catch {
    // Nothing is mounted to report a failed report to; the shell has logged the error itself.
  }
};
