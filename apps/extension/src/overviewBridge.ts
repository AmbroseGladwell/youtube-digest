// The protocol the injected button, the service worker and the side panel speak. Three
// documents, one conversation: the page asks for a run, the panel does it, and the
// worker is the only one of the three that is always alive to carry the answer back
// (docs/features/injected-button.md).

export const BridgeMessage = {
  REQUEST_OVERVIEW: "overview/request-overview",
  TAKE_REQUEST: "overview/take-request",
  REPORT_RUN: "overview/report-run",
  READ_BUTTON_STATE: "overview/read-button-state",
  BUTTON_STATE_CHANGED: "overview/button-state-changed",
} as const;

export type ButtonStateKind = "idle" | "generating" | "ready";

export interface ButtonState {
  kind: ButtonStateKind;
  // The moment the run started, measured by whoever started it. The button ticks its own
  // clock from this rather than being sent a duration (docs/prototype/constraints.md).
  startedAt: number | null;
  progressFraction: number;
}

export const IDLE_BUTTON_STATE: ButtonState = {
  kind: "idle",
  startedAt: null,
  progressFraction: 0,
};

export interface RequestOverviewMessage {
  type: typeof BridgeMessage.REQUEST_OVERVIEW;
  videoUrl: string;
}

export interface TakeRequestMessage {
  type: typeof BridgeMessage.TAKE_REQUEST;
}

export interface ReadButtonStateMessage {
  type: typeof BridgeMessage.READ_BUTTON_STATE;
  videoId: string;
}

export interface ButtonStateChangedMessage {
  type: typeof BridgeMessage.BUTTON_STATE_CHANGED;
  videoId: string | null;
  state: ButtonState;
}

const isTyped = (message: unknown, type: string): boolean =>
  typeof message === "object" && message !== null && (message as { type?: unknown }).type === type;

export const isRequestOverview = (message: unknown): message is RequestOverviewMessage =>
  isTyped(message, BridgeMessage.REQUEST_OVERVIEW);

export const isTakeRequest = (message: unknown): message is TakeRequestMessage =>
  isTyped(message, BridgeMessage.TAKE_REQUEST);

export const isReportRun = (message: unknown): boolean =>
  isTyped(message, BridgeMessage.REPORT_RUN);

export const isReadButtonState = (message: unknown): message is ReadButtonStateMessage =>
  isTyped(message, BridgeMessage.READ_BUTTON_STATE);

export const isButtonStateChanged = (message: unknown): message is ButtonStateChangedMessage =>
  isTyped(message, BridgeMessage.BUTTON_STATE_CHANGED);
