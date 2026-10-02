import base64
import logging
import threading
import time
from typing import Annotated, Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from pydantic.alias_generators import to_camel

from .encode_m4a import encode_m4a
from .idle_exit import IdleExit
from .posthog_exception_reporter import ExceptionReporter
from .render_script import RENDER_VERSION, Synthesiser, render_script

MAX_SCRIPT_CHARACTERS = 20_000

log = logging.getLogger(__name__)

SpokenLine = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class RenderRequest(CamelModel):
    lines: list[SpokenLine] = Field(min_length=1)
    voice: str
    language: Literal["en-us", "en-gb"]
    render_version: int

    @field_validator("lines")
    @classmethod
    def within_cap(cls, lines: list[str]) -> list[str]:
        if sum(len(line) for line in lines) > MAX_SCRIPT_CHARACTERS:
            raise ValueError(f"A spoken script is at most {MAX_SCRIPT_CHARACTERS} characters")
        return lines


class RenderResponse(CamelModel):
    render_version: int
    line_starts_seconds: list[float]
    duration_seconds: float
    synthesis_seconds: float
    audio_base64: str


class ServiceError(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def error_response(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


def create_app(
    synthesiser: Synthesiser, idle_exit: IdleExit, report_exception: ExceptionReporter | None = None
) -> FastAPI:
    app = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)
    one_render_at_a_time = threading.Lock()

    def report(error: Exception) -> None:
        try:
            report_exception(error)
        except Exception as failure:
            log.warning("error not forwarded: %s", type(failure).__name__)

    @app.exception_handler(ServiceError)
    async def service_error(_: Request, error: ServiceError) -> JSONResponse:
        return error_response(error.status, error.code, error.message)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(_: Request, error: RequestValidationError) -> JSONResponse:
        return error_response(422, "invalid_request", str(error.errors()[0].get("msg", "Invalid request")))

    # A failure nothing planned for: answered in the API's envelope, then reported once the
    # answer has gone (docs/architecture/errors-and-logs.md, "The TTS service").
    @app.exception_handler(Exception)
    async def unexpected(_: Request, error: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": "Something went wrong"}},
            background=None if report_exception is None else BackgroundTask(report, error),
        )

    @app.get("/health")
    def health() -> dict:
        return {"renderVersion": RENDER_VERSION, "voices": sorted(synthesiser.voices())}

    @app.post("/render", response_model=RenderResponse, response_model_by_alias=True)
    def render(request: RenderRequest) -> RenderResponse:
        with idle_exit.busy():
            if request.render_version != RENDER_VERSION:
                raise ServiceError(
                    409,
                    "render_version_mismatch",
                    f"This service renders version {RENDER_VERSION}, not {request.render_version}",
                )
            if request.voice not in synthesiser.voices():
                raise ServiceError(422, "unknown_voice", f"No voice named {request.voice}")
            with one_render_at_a_time:
                started = time.perf_counter()
                rendered = render_script(synthesiser, request.lines, request.voice, request.language)
                synthesis_seconds = time.perf_counter() - started
                audio = encode_m4a(rendered.samples, rendered.sample_rate)
            return RenderResponse(
                render_version=RENDER_VERSION,
                line_starts_seconds=rendered.line_starts_seconds,
                duration_seconds=rendered.duration_seconds,
                synthesis_seconds=round(synthesis_seconds, 2),
                audio_base64=base64.b64encode(audio).decode("ascii"),
            )

    return app
