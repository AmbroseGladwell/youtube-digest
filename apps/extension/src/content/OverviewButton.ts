import { elapsedLabel } from "../elapsedLabel.js";
import { IDLE_BUTTON_STATE, type ButtonState } from "../overviewBridge.js";
import { ensureOverviewButtonStyles, OVERVIEW_BUTTON_ID } from "./overviewButtonStyles.js";

const LABEL: Record<ButtonState["kind"], string> = {
  idle: "Overview",
  generating: "Creating",
  ready: "Overview ready",
};

const MARK = `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
  <circle cx="12" cy="10" r="6.4" stroke="currentColor" stroke-width="2.4"></circle>
  <rect x="4.4" y="19.1" width="15.2" height="2.4" rx="1.2" fill="currentColor"></rect>
</svg>`;

export class OverviewButton {
  readonly element: HTMLButtonElement;

  #label: HTMLSpanElement;
  #bar: HTMLSpanElement;
  #state: ButtonState = IDLE_BUTTON_STATE;
  #clock: ReturnType<typeof setInterval> | null = null;

  constructor(onPress: () => void) {
    ensureOverviewButtonStyles();

    this.element = document.createElement("button");
    this.element.id = OVERVIEW_BUTTON_ID;
    this.element.type = "button";

    // Neither is touched again: which of them shows is the stylesheet's job, off the
    // one state attribute.
    const mark = document.createElement("span");
    mark.className = "ovb-mark";
    mark.innerHTML = MARK;

    const spinner = document.createElement("span");
    spinner.className = "ovb-spinner";

    this.#label = document.createElement("span");
    this.#label.className = "ovb-label";
    // The label is the only thing that reports a finished run to anyone not watching the
    // pill, so it is announced rather than silently swapped.
    this.#label.setAttribute("aria-live", "polite");

    this.#bar = document.createElement("span");
    this.#bar.className = "ovb-bar";

    this.element.append(mark, spinner, this.#label, this.#bar);
    this.element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onPress();
    });

    this.setState(IDLE_BUTTON_STATE);
  }

  get kind(): ButtonState["kind"] {
    return this.#state.kind;
  }

  setState(state: ButtonState): void {
    this.#state = state;
    this.element.dataset.state = state.kind;

    this.#bar.style.width = `${Math.round(state.progressFraction * 100)}%`;

    this.element.setAttribute(
      "aria-label",
      state.kind === "ready"
        ? "Read the overview of this video"
        : "Create an overview of this video",
    );

    this.#paintLabel();
    this.#runClock();
  }

  remove(): void {
    this.#stopClock();
    this.element.remove();
  }

  #paintLabel(): void {
    const { kind, startedAt } = this.#state;
    this.#label.textContent =
      kind === "generating" && startedAt !== null
        ? `${LABEL.generating} · ${elapsedLabel(startedAt, Date.now())}`
        : LABEL[kind];
  }

  // Ticked from the run's own startedAt rather than counted up from zero here, so a
  // panel opened late still shows how long the run has actually been going.
  #runClock(): void {
    this.#stopClock();
    if (this.#state.kind !== "generating" || this.#state.startedAt === null) {
      return;
    }
    this.#clock = setInterval(() => this.#paintLabel(), 1000);
  }

  #stopClock(): void {
    if (this.#clock !== null) {
      clearInterval(this.#clock);
      this.#clock = null;
    }
  }
}
