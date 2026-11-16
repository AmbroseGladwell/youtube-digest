import os
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import modal

MODEL = "large-v3-turbo"
SAMPLE_RATE = 16000
MOST_AUDIO_BYTES = 700 * 1024 * 1024
DOWNLOAD_TIMEOUT_SECONDS = 30
BATCH_SIZE = 32
# One app per environment, each with its own token, so dev runs never touch production's:
# `overview-stt` for dev, `overview-stt-prod` for production (docs/features/speech-to-text.md,
# "Switching it on"). Baked into the image, so the containers name the same app's Dict.
NAME = os.environ.get("OVERVIEW_STT_APP", "overview-stt")


def fetch_model() -> None:
    from faster_whisper import download_model

    download_model(MODEL)


image = (
    modal.Image.from_registry("nvidia/cuda:12.6.3-cudnn-runtime-ubuntu22.04", add_python="3.12")
    .apt_install("ffmpeg")
    .pip_install("faster-whisper==1.2.1", "numpy>=2.0", "fastapi[standard]>=0.115")
    .run_function(fetch_model)
    .env({"OVERVIEW_STT_APP": NAME})
)

app = modal.App(NAME, image=image)
started = modal.Dict.from_name(f"{NAME}-started", create_if_missing=True)
secret = modal.Secret.from_name(NAME)


class Refused(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def download(url: str, into: Path) -> int:
    request = urllib.request.Request(url, headers={"User-Agent": "TheOverview-Transcriber/1.0"})
    total = 0
    try:
        with urllib.request.urlopen(request, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response, into.open("wb") as out:
            while chunk := response.read(1024 * 1024):
                total += len(chunk)
                if total > MOST_AUDIO_BYTES:
                    raise Refused("audio_too_large")
                out.write(chunk)
    except Refused:
        raise
    except Exception as error:
        raise Refused("audio_unreachable") from error
    return total


def decode(audio: Path):
    import numpy as np

    try:
        raw = subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-i", str(audio), "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "f32le", "-"],
            capture_output=True,
            check=True,
        ).stdout
    except subprocess.CalledProcessError as error:
        raise Refused("audio_unreadable") from error
    return np.frombuffer(raw, dtype=np.float32)


@app.cls(gpu=["T4", "L4", "A10", "L40S"], timeout=900, scaledown_window=10)
class Transcriber:
    @modal.enter()
    def load(self) -> None:
        from faster_whisper import BatchedInferencePipeline, WhisperModel

        loading = time.perf_counter()
        self.pipeline = BatchedInferencePipeline(WhisperModel(MODEL, device="cuda", compute_type="float16"))
        self.model_load_seconds = round(time.perf_counter() - loading, 2)
        self.cold = True

    @modal.method()
    def transcribe(self, audio_url: str, max_seconds: int) -> dict:
        began = time.perf_counter()
        started[modal.current_function_call_id()] = time.time()
        cold, self.cold = self.cold, False
        with tempfile.TemporaryDirectory() as folder:
            audio_path = Path(folder) / "episode"
            audio_bytes = download(audio_url, audio_path)
            audio = decode(audio_path)
        audio_seconds = len(audio) / SAMPLE_RATE
        if audio_seconds > max_seconds:
            raise Refused("audio_too_long")
        segments, info = self.pipeline.transcribe(audio, beam_size=1, batch_size=BATCH_SIZE)
        kept = [
            {"startMs": round(s.start * 1000), "endMs": round(s.end * 1000), "text": s.text.strip()} for s in segments if s.text.strip()
        ]
        if not kept:
            raise Refused("no_speech")
        gpu = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], capture_output=True, text=True).stdout.strip()
        return {
            "segments": kept,
            "audioSeconds": round(audio_seconds, 1),
            "audioBytes": audio_bytes,
            "language": info.language,
            "gpu": gpu,
            "cold": cold,
            "modelLoadSeconds": self.model_load_seconds if cold else 0,
            "workerSeconds": round(time.perf_counter() - began, 1),
        }


@app.function(secrets=[secret], image=image)
@modal.concurrent(max_inputs=50)
@modal.asgi_app()
def jobs():
    import hmac

    from fastapi import Depends, FastAPI, Header, HTTPException
    from pydantic import BaseModel, Field

    web = FastAPI()

    def authorised(authorization: str = Header("")) -> None:
        if not hmac.compare_digest(authorization, f"Bearer {os.environ['STT_TOKEN']}"):
            raise HTTPException(status_code=401)

    class Submit(BaseModel):
        audioUrl: str = Field(min_length=1, max_length=4096)
        maxSeconds: int = Field(gt=0, le=6 * 3600)

    @web.post("/jobs", dependencies=[Depends(authorised)])
    async def submit(body: Submit) -> dict:
        call = await Transcriber().transcribe.spawn.aio(body.audioUrl, body.maxSeconds)
        return {"callId": call.object_id}

    @web.get("/jobs/{call_id}", dependencies=[Depends(authorised)])
    async def status(call_id: str) -> dict:
        call = modal.FunctionCall.from_id(call_id)
        try:
            result = await call.get.aio(timeout=0)
        except TimeoutError:
            return {"state": "running" if await started.contains.aio(call_id) else "waiting"}
        except Refused as refused:
            await started.pop.aio(call_id, None)
            return {"state": "failed", "error": refused.code}
        except Exception as error:
            await started.pop.aio(call_id, None)
            return {"state": "failed", "error": "worker_failed", "detail": type(error).__name__}
        await started.pop.aio(call_id, None)
        return {"state": "done", "result": result}

    @web.delete("/jobs/{call_id}", dependencies=[Depends(authorised)])
    async def cancel(call_id: str) -> dict:
        await modal.FunctionCall.from_id(call_id).cancel.aio()
        await started.pop.aio(call_id, None)
        return {}

    return web
