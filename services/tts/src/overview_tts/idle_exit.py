import threading
import time
from collections.abc import Callable
from contextlib import contextmanager
from typing import Iterator, Protocol


class Cancellable(Protocol):
    def cancel(self) -> None: ...


Schedule = Callable[[float, Callable[[], None]], Cancellable]


def schedule_with_timer(delay: float, action: Callable[[], None]) -> Cancellable:
    timer = threading.Timer(delay, action)
    timer.daemon = True
    timer.start()
    return timer


# The grace counts only time the machine could have rendered, so it starts when the model is
# ready rather than when the process does (docs/architecture/deploy.md, "The TTS service").
class IdleExit:
    def __init__(
        self,
        grace_seconds: float,
        on_idle: Callable[[], None],
        schedule: Schedule = schedule_with_timer,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._grace_seconds = grace_seconds
        self._on_idle = on_idle
        self._schedule = schedule
        self._clock = clock
        self._lock = threading.Lock()
        self._in_flight = 0
        self._pending: Cancellable | None = None
        self._ready_at: float | None = None

    def start(self) -> None:
        with self._lock:
            self._ready_at = self._clock()
            if self._in_flight == 0:
                self._arm()

    def serving_seconds(self) -> float:
        return 0.0 if self._ready_at is None else self._clock() - self._ready_at

    @contextmanager
    def busy(self) -> Iterator[None]:
        with self._lock:
            self._in_flight += 1
            self._disarm()
        try:
            yield
        finally:
            with self._lock:
                self._in_flight -= 1
                if self._in_flight == 0 and self._ready_at is not None:
                    self._arm()

    def _arm(self) -> None:
        self._disarm()
        self._pending = self._schedule(self._grace_seconds, self._fire)

    def _disarm(self) -> None:
        if self._pending is not None:
            self._pending.cancel()
            self._pending = None

    def _fire(self) -> None:
        with self._lock:
            if self._in_flight > 0:
                return
        self._on_idle()
