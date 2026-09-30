import os
from pathlib import Path

import uvicorn

from .create_app import create_app
from .idle_exit import IdleExit
from .kokoro_synthesiser import KokoroSynthesiser, LoadingSynthesiser


def main() -> None:
    model_dir = Path(os.environ.get("MODEL_DIR", "models"))
    synthesiser = LoadingSynthesiser(lambda: KokoroSynthesiser(model_dir))

    def stop() -> None:
        server.should_exit = True

    idle_exit = IdleExit(float(os.environ.get("IDLE_EXIT_SECONDS", "15")), stop)
    app = create_app(synthesiser, idle_exit)
    # Fly's proxy connects over IPv4, and asyncio makes a "::" socket IPv6-only
    # (docs/architecture/deploy.md, "The TTS service").
    server = uvicorn.Server(uvicorn.Config(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000"))))
    server.run()


if __name__ == "__main__":
    main()
