from dataclasses import dataclass
from collections.abc import Mapping
from urllib.parse import unquote, urlparse

DEFAULT_SERVICE_NAME = "overview-tts"


class OtlpLogsConfigError(Exception):
    pass


@dataclass(frozen=True)
class OtlpLogsConfig:
    endpoint: str
    headers: dict[str, str]
    resource: dict[str, str]


def _key_value_list(raw: str | None, name: str) -> dict[str, str]:
    entries: dict[str, str] = {}
    for pair in (raw or "").split(","):
        if pair.strip() == "":
            continue
        key, separator, value = pair.partition("=")
        if separator == "" or key.strip() == "":
            raise OtlpLogsConfigError(f"{name} must be key=value pairs separated by commas")
        entries[unquote(key.strip())] = unquote(value.strip())
    return entries


# The API's otlpLogsConfig, ported: the standard OTEL_* variables name the destination, and
# with none set the service ships to PostHog's log ingest under the project token it already
# holds (docs/architecture/errors-and-logs.md, "Shipping the server's logs").
def otlp_logs_config(env: Mapping[str, str], posthog_api_key: str | None, posthog_host: str, environment: str) -> OtlpLogsConfig | None:
    if env.get("OTEL_LOGS_EXPORTER", "").strip() == "none":
        return None
    protocol = env.get("OTEL_EXPORTER_OTLP_LOGS_PROTOCOL", env.get("OTEL_EXPORTER_OTLP_PROTOCOL"))
    if protocol is not None and protocol.strip() != "http/json":
        raise OtlpLogsConfigError(f"OTEL_EXPORTER_OTLP_LOGS_PROTOCOL is {protocol}, and only http/json is supported")

    named = env.get("OTEL_EXPORTER_OTLP_LOGS_ENDPOINT")
    if named is None and env.get("OTEL_EXPORTER_OTLP_ENDPOINT") is not None:
        named = env["OTEL_EXPORTER_OTLP_ENDPOINT"].rstrip("/") + "/v1/logs"
    endpoint = named if named is not None else (None if not posthog_api_key else posthog_host.rstrip("/") + "/i/v1/logs")
    if endpoint is None:
        return None
    if urlparse(endpoint).scheme not in ("http", "https"):
        raise OtlpLogsConfigError(f"the OTLP logs endpoint {endpoint} is not a URL")

    named_headers = env.get("OTEL_EXPORTER_OTLP_LOGS_HEADERS", env.get("OTEL_EXPORTER_OTLP_HEADERS"))
    headers = (
        {"authorization": f"Bearer {posthog_api_key}"}
        if named is None and named_headers is None and posthog_api_key
        else _key_value_list(named_headers, "OTEL_EXPORTER_OTLP_LOGS_HEADERS")
    )
    return OtlpLogsConfig(
        endpoint=endpoint,
        headers=headers,
        resource={
            "deployment.environment.name": environment,
            **_key_value_list(env.get("OTEL_RESOURCE_ATTRIBUTES"), "OTEL_RESOURCE_ATTRIBUTES"),
            "service.name": env.get("OTEL_SERVICE_NAME", DEFAULT_SERVICE_NAME),
        },
    )
