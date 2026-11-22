// docs/features/injected-button.md, "Three documents, one conversation".

export const BridgeMessage = {
  REQUEST_OVERVIEW: "overview/request-overview",
  TAKE_REQUEST: "overview/take-request",
  REPORT_RUN: "overview/report-run",
  READ_BUTTON_STATE: "overview/read-button-state",
  BUTTON_STATE_CHANGED: "overview/button-state-changed",
  PAGE_MENU_REQUEST: "overview/page-menu-request",
  TAKE_PAGE_REQUEST: "overview/take-page-request",
} as const;

export type ButtonStateKind = "idle" | "generating" | "ready";

export interface ButtonState {
  kind: ButtonStateKind;
  // docs/prototype/constraints.md, "Never let a model count, measure or time anything".
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

export const isRequestOverview = (message: unknown): message is RequestOverviewMessage => isTyped(message, BridgeMessage.REQUEST_OVERVIEW);

export const isTakeRequest = (message: unknown): message is TakeRequestMessage => isTyped(message, BridgeMessage.TAKE_REQUEST);

export const isReportRun = (message: unknown): boolean => isTyped(message, BridgeMessage.REPORT_RUN);

export const isReadButtonState = (message: unknown): message is ReadButtonStateMessage => isTyped(message, BridgeMessage.READ_BUTTON_STATE);

export const isPageMenuRequest = (message: unknown): boolean => isTyped(message, BridgeMessage.PAGE_MENU_REQUEST);

export const isTakePageRequest = (message: unknown): boolean => isTyped(message, BridgeMessage.TAKE_PAGE_REQUEST);

export const isButtonStateChanged = (message: unknown): message is ButtonStateChangedMessage =>
  isTyped(message, BridgeMessage.BUTTON_STATE_CHANGED);
