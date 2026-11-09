import type { Provider } from "@overview/domain";

// What a failed run tells the reader. A model they chose gets our own words and a way to
// change it, never the provider's response (OV-247).
export type RunError = { kind: "message"; message: string } | { kind: "chosenModel"; provider: Provider; model: string };
