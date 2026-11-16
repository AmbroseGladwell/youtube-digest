# The GPU benchmark worker for RunPod serverless, with both models baked in
# (docs/features/speech-to-text.md). Modal builds the same environment from modal_benchmark.py.
FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu24.04

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --break-system-packages "faster-whisper==1.2.1" "onnx-asr[gpu,hub]==0.12.0" "numpy>=2.0" "runpod>=1.7" \
 && pip uninstall -y --break-system-packages onnxruntime onnxruntime-gpu \
 && pip install --no-cache-dir --break-system-packages "onnxruntime-gpu[cuda,cudnn]==1.32.0"

WORKDIR /worker
COPY speech_engines.py gpu_worker.py runpod_handler.py ./
RUN python3 -c "from speech_engines import fetch_models; fetch_models()"

CMD ["python3", "-u", "runpod_handler.py"]
