import test from "node:test";
import assert from "node:assert/strict";
import { OtlpLogsConfigError, otlpLogsConfig } from "./otlpLogsConfig.js";

const postHog = { apiKey: "phc_test", host: "https://eu.i.posthog.com/" };

test("with no OTEL variables and no PostHog key, logs go to stdout only", () => {
  assert.equal(otlpLogsConfig({}, { postHog: null, environment: "development" }), null);
});

test("with a PostHog key and nothing else, logs go to PostHog's log ingest under the same project token", () => {
  assert.deepEqual(otlpLogsConfig({}, { postHog, environment: "production" }), {
    endpoint: "https://eu.i.posthog.com/i/v1/logs",
    headers: { authorization: "Bearer phc_test" },
    resource: { "deployment.environment.name": "production", "service.name": "overview-api" },
  });
});

test("the standard OTEL variables name another destination without a code change, and win over PostHog", () => {
  const config = otlpLogsConfig(
    {
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp.grafana.example/otlp/",
      OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Basic%20abc123,x-scope=overview",
      OTEL_SERVICE_NAME: "overview-api-eu",
      OTEL_RESOURCE_ATTRIBUTES: "service.version=0.4.1",
    },
    { postHog, environment: "production" },
  );

  assert.deepEqual(config, {
    endpoint: "https://otlp.grafana.example/otlp/v1/logs",
    headers: { Authorization: "Basic abc123", "x-scope": "overview" },
    resource: { "deployment.environment.name": "production", "service.version": "0.4.1", "service.name": "overview-api-eu" },
  });
  assert.equal(
    otlpLogsConfig({ OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "https://logs.example/ingest" }, { postHog, environment: "production" })!.endpoint,
    "https://logs.example/ingest",
  );
});

test("a destination named without headers isn't handed the PostHog token", () => {
  const config = otlpLogsConfig({ OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "https://logs.example/v1/logs" }, { postHog, environment: "production" });

  assert.deepEqual(config!.headers, {});
});

test("OTEL_LOGS_EXPORTER=none turns shipping off, even with a key", () => {
  assert.equal(otlpLogsConfig({ OTEL_LOGS_EXPORTER: "none" }, { postHog, environment: "production" }), null);
});

test("a protocol other than http/json, a malformed header list, or an endpoint that isn't a URL is refused", () => {
  const refused = (env: Record<string, string>) =>
    assert.throws(() => otlpLogsConfig(env, { postHog, environment: "production" }), OtlpLogsConfigError);

  refused({ OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "grpc" });
  refused({ OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf" });
  refused({ OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "https://logs.example/v1/logs", OTEL_EXPORTER_OTLP_LOGS_HEADERS: "no-equals-sign" });
  refused({ OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: "logs.example" });
  assert.ok(otlpLogsConfig({ OTEL_EXPORTER_OTLP_PROTOCOL: "http/json" }, { postHog, environment: "production" }));
});
