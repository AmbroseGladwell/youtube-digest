import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "download_model.sh"
MODEL_FILE = "kokoro-v1.0.onnx"
RETRIES = 5


class ReleaseHost:
    def __init__(self, failures: int, body: bytes = b"not the model"):
        self.failures = failures
        self.body = body
        self.requests: list[str] = []
        self.ranges: list[str | None] = []
        host = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                host.requests.append(self.path)
                host.ranges.append(self.headers.get("Range"))
                if len(host.requests) <= host.failures:
                    self.send_response(504)
                    self.end_headers()
                    return
                self.send_response(200)
                self.send_header("Content-Length", str(len(host.body)))
                self.end_headers()
                self.wfile.write(host.body)

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_port}"

    def close(self):
        self.server.shutdown()


@pytest.fixture
def release_host(request):
    host = ReleaseHost(**request.param)
    yield host
    host.close()


def download(host: ReleaseHost, models: Path) -> subprocess.CompletedProcess:
    env = {**os.environ, "KOKORO_RELEASE_URL": host.url, "KOKORO_RETRY_DELAY_SECONDS": "1"}
    return subprocess.run([str(SCRIPT), str(models)], env=env, capture_output=True, text=True)


@pytest.mark.parametrize("release_host", [{"failures": 2}], indirect=True)
def test_a_504_is_retried_and_what_finally_arrives_is_still_hash_checked(release_host, tmp_path):
    result = download(release_host, tmp_path)

    assert release_host.requests == [f"/{MODEL_FILE}"] * 3
    assert result.returncode == 1
    assert f"{MODEL_FILE} does not match its pinned SHA-256" in result.stderr
    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("release_host", [{"failures": RETRIES + 1}], indirect=True)
def test_a_host_that_keeps_failing_fails_the_download_after_the_retries(release_host, tmp_path):
    result = download(release_host, tmp_path)

    assert len(release_host.requests) == RETRIES + 1
    assert result.returncode != 0
    assert "504" in result.stderr
    assert not (tmp_path / MODEL_FILE).exists()


@pytest.mark.parametrize("release_host", [{"failures": 0}], indirect=True)
def test_a_part_file_left_by_an_interrupted_run_is_discarded_not_resumed(release_host, tmp_path):
    (tmp_path / f"{MODEL_FILE}.part").write_bytes(b"half a model")

    result = download(release_host, tmp_path)

    assert release_host.ranges == [None]
    assert result.returncode == 1
    assert list(tmp_path.iterdir()) == []
