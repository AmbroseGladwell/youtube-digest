// The ready line (OV-164, 175d): says what's done and when writing starts, never who the reader is
// or which screen they're on.
export const writingStarts = (soon: boolean): string => `Writing starts ${soon ? "when you continue" : "in a few taps"}`;
