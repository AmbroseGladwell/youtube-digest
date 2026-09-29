# The private narration service: Kokoro behind POST /render (docs/features/tts-pre-rendered-speech.md).
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.12.17 /uv /usr/local/bin/uv

WORKDIR /app
COPY download_model.sh ./
RUN ./download_model.sh models

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev

ENV MODEL_DIR=/app/models \
    PATH=/app/.venv/bin:$PATH \
    PORT=8000
CMD ["python", "-m", "overview_tts.serve"]
