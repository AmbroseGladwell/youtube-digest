import os
from pathlib import Path

import uvicorn

from .create_app import create_app
from .idle_exit import IdleExit
from .kokoro_synthesiser import KokoroSynthesiser, LoadingSynthesiser
from .posthog_exception_reporter import create_posthog_exception_reporter


def main() -> None:
    model_dir = Path(os.environ.get("MODEL_DIR", "models"))
    synthesiser = LoadingSynthesiser(lambda: KokoroSynthesiser(model_dir))

    def stop() -> None:
        server.should_exit = True

    idle_exit = IdleExit(float(os.environ.get("IDLE_EXIT_SECONDS", "15")), stop)
    api_key = os.environ.get("POSTHOG_API_KEY")
    report_exception = (
        None
        if not api_key
        else create_posthog_exception_reporter(
            api_key,
            os.environ.get("POSTHOG_HOST", "https://eu.i.posthog.com"),
            os.environ.get("ANALYTICS_ENVIRONMENT", "development"),
        )
    )
    app = create_app(synthesiser, idle_exit, report_exception)
    # Fly's proxy connects over IPv4, and asyncio makes a "::" socket IPv6-only
    # (docs/architecture/deploy.md, "The TTS service").
    server = uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000"))))
    server.run()


if __name__ == "__main__":
    main()
