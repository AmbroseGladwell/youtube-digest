import pytest

from overview_tts.otlp_logs_config import OtlpLogsConfigError, otlp_logs_config


def test_with_nothing_named_logs_ship_to_posthog_under_the_project_token():
    config = otlp_logs_config({}, "project-token", "https://eu.i.posthog.com/", "production")

    assert config.endpoint == "https://eu.i.posthog.com/i/v1/logs"
    assert config.headers == {"authorization": "Bearer project-token"}
    assert config.resource == {"deployment.environment.name": "production", "service.name": "overview-tts"}


def test_without_a_token_or_a_destination_logs_stay_on_stdout():
    assert otlp_logs_config({}, None, "https://eu.i.posthog.com", "development") is None


def test_a_destination_named_without_headers_is_never_handed_the_posthog_token():
    config = otlp_logs_config({"OTEL_EXPORTER_OTLP_ENDPOINT": "https://otlp.example/"}, "project-token", "https://eu.i.posthog.com", "production")

    assert config.endpoint == "https://otlp.example/v1/logs"
    assert config.headers == {}


def test_logs_can_be_turned_off_and_another_protocol_is_refused():
    assert otlp_logs_config({"OTEL_LOGS_EXPORTER": "none"}, "project-token", "https://eu.i.posthog.com", "production") is None
    with pytest.raises(OtlpLogsConfigError):
        otlp_logs_config({"OTEL_EXPORTER_OTLP_PROTOCOL": "grpc"}, "project-token", "https://eu.i.posthog.com", "production")
