"""Kokoro on a Modal GPU, behind the same /render/stream and /health as the Fly pool
(docs/features/tts-pre-rendered-speech.md, "Where Kokoro runs"). One app per environment, each with its own
token: `overview-tts` for dev, `overview-tts-prod` for production, deployed by deploy_modal.sh."""

import os

import modal

NAME = os.environ.get("OVERVIEW_TTS_APP", "overview-tts")
MODEL_DIR = "/models"
GPUS = ["T4", "A10", "L4"]
SCALEDOWN_SECONDS = 5
# Two renders share a T4 with no gaps up to 20 readers; four fall behind (OV-431's load test).
RENDERS_PER_CONTAINER = 2
MOST_CONTAINERS = 5

image = (
    modal.Image.from_registry("nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04", add_python="3.12")
    .apt_install("curl", "ca-certificates", "ffmpeg")
    .pip_install("fastapi>=0.142", "kokoro-onnx==0.6.1", "numpy")
    # kokoro-onnx brings the CPU onnxruntime, which hides the GPU one; 1.22 is the last built for CUDA 12.
    .run_commands("pip uninstall -y onnxruntime", "pip install onnxruntime-gpu==1.22.0")
    .add_local_file("download_model.sh", "/download_model.sh", copy=True)
    .run_commands(f"bash /download_model.sh {MODEL_DIR}")
    .env({"OVERVIEW_TTS_APP": NAME})
    .add_local_dir("src/overview_tts", "/root/overview_tts")
)

app = modal.App(NAME, image=image)
secret = modal.Secret.from_name(NAME)


@app.cls(gpu=GPUS, secrets=[secret], scaledown_window=SCALEDOWN_SECONDS, timeout=600, max_containers=MOST_CONTAINERS)
@modal.concurrent(max_inputs=RENDERS_PER_CONTAINER)
class Speaker:
    @modal.enter()
    def load(self) -> None:
        from pathlib import Path

        from overview_tts.kokoro_synthesiser import KokoroSynthesiser

        self.synthesiser = KokoroSynthesiser(Path(MODEL_DIR), providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
        if self.synthesiser.providers[0] != "CUDAExecutionProvider":
            raise RuntimeError(f"Kokoro is not on the GPU: {self.synthesiser.providers}")
        self.synthesiser.speak("Ready.", "af_heart", "en-us")
        import subprocess

        named = subprocess.run(["nvidia-smi", "--query-gpu=name", "--format=csv,noheader"], capture_output=True, text=True)
        self.synthesiser.gpu = named.stdout.strip() or None

    @modal.asgi_app()
    def web(self):
        import hmac

        from fastapi import Request
        from fastapi.responses import JSONResponse

        from overview_tts.create_app import create_app
        from overview_tts.idle_exit import IdleExit

        served = create_app(self.synthesiser, IdleExit(float("inf"), lambda: None), renders_at_once=RENDERS_PER_CONTAINER)
        expected = f"Bearer {os.environ['TTS_TOKEN']}"

        @served.middleware("http")
        async def authorised(request: Request, call_next):
            if not hmac.compare_digest(request.headers.get("authorization", ""), expected):
                return JSONResponse(status_code=401, content={"error": {"code": "unauthenticated", "message": "No valid token"}})
            return await call_next(request)

        return served
