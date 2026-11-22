export interface OtlpLogsConfig {
  endpoint: string;
  headers: Record<string, string>;
  resource: Record<string, string>;
}

export interface OtlpLogsEnv {
  OTEL_LOGS_EXPORTER?: string | undefined;
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT?: string | undefined;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string | undefined;
  OTEL_EXPORTER_OTLP_LOGS_HEADERS?: string | undefined;
  OTEL_EXPORTER_OTLP_HEADERS?: string | undefined;
  OTEL_EXPORTER_OTLP_LOGS_PROTOCOL?: string | undefined;
  OTEL_EXPORTER_OTLP_PROTOCOL?: string | undefined;
  OTEL_SERVICE_NAME?: string | undefined;
  OTEL_RESOURCE_ATTRIBUTES?: string | undefined;
}

export interface PostHogLogsFallback {
  apiKey: string;
  host: string;
}

export class OtlpLogsConfigError extends Error {}

const DEFAULT_SERVICE_NAME = "overview-api";

// "key=value,key2=value2", percent-encoded: the OpenTelemetry spec's format for headers and attributes.
const keyValueList = (raw: string | undefined, name: string): Record<string, string> => {
  const entries: Array<[string, string]> = [];
  for (const pair of (raw ?? "").split(",")) {
    if (pair.trim() === "") {
      continue;
    }
    const at = pair.indexOf("=");
    if (at <= 0) {
      throw new OtlpLogsConfigError(`${name} must be key=value pairs separated by commas`);
    }
    entries.push([decodeURIComponent(pair.slice(0, at).trim()), decodeURIComponent(pair.slice(at + 1).trim())]);
  }
  return Object.fromEntries(entries);
};

export interface OtlpLogsConfigOptions {
  postHog: PostHogLogsFallback | null;
  environment: string;
}

// Defaults and opting out: docs/architecture/errors-and-logs.md, "Shipping the server's logs".
export const otlpLogsConfig = (env: OtlpLogsEnv, { postHog, environment }: OtlpLogsConfigOptions): OtlpLogsConfig | null => {
  if (env.OTEL_LOGS_EXPORTER?.trim() === "none") {
    return null;
  }
  const protocol = env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL ?? env.OTEL_EXPORTER_OTLP_PROTOCOL;
  if (protocol !== undefined && protocol.trim() !== "http/json") {
    throw new OtlpLogsConfigError(`OTEL_EXPORTER_OTLP_LOGS_PROTOCOL is ${protocol}, and only http/json is supported`);
  }

  const named =
    env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
    (env.OTEL_EXPORTER_OTLP_ENDPOINT === undefined ? undefined : `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/+$/, "")}/v1/logs`);
  const endpoint = named ?? (postHog === null ? null : `${postHog.host.replace(/\/+$/, "")}/i/v1/logs`);
  if (endpoint === null) {
    return null;
  }
  try {
    new URL(endpoint);
  } catch {
    throw new OtlpLogsConfigError(`the OTLP logs endpoint ${endpoint} is not a URL`);
  }

  const namedHeaders = env.OTEL_EXPORTER_OTLP_LOGS_HEADERS ?? env.OTEL_EXPORTER_OTLP_HEADERS;
  const headers =
    named === undefined && namedHeaders === undefined && postHog !== null
      ? { authorization: `Bearer ${postHog.apiKey}` }
      : keyValueList(namedHeaders, "OTEL_EXPORTER_OTLP_LOGS_HEADERS");

  return {
    endpoint,
    headers,
    resource: {
      "deployment.environment.name": environment,
      ...keyValueList(env.OTEL_RESOURCE_ATTRIBUTES, "OTEL_RESOURCE_ATTRIBUTES"),
      "service.name": env.OTEL_SERVICE_NAME ?? DEFAULT_SERVICE_NAME,
    },
  };
};
