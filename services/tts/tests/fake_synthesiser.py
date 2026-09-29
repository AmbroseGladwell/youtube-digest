import numpy as np


class FakeSynthesiser:
    sample_rate = 1000
    samples_per_character = 10

    def __init__(self, voices: set[str] | None = None):
        self._voices = voices or {"af_heart", "bf_emma"}
        self.spoken: list[tuple[str, str, str]] = []

    def voices(self) -> set[str]:
        return self._voices

    def speak(self, text: str, voice: str, language: str) -> np.ndarray:
        self.spoken.append((text, voice, language))
        return np.full(len(text) * self.samples_per_character, 0.5, dtype=np.float32)


class FakeSchedule:
    def __init__(self):
        self.scheduled: list["FakeTimer"] = []

    def __call__(self, delay, action):
        timer = FakeTimer(delay, action)
        self.scheduled.append(timer)
        return timer

    @property
    def armed(self) -> list["FakeTimer"]:
        return [timer for timer in self.scheduled if not timer.cancelled]


class FakeTimer:
    def __init__(self, delay, action):
        self.delay = delay
        self.action = action
        self.cancelled = False

    def cancel(self) -> None:
        self.cancelled = True

    def fire(self) -> None:
        if not self.cancelled:
            self.action()
