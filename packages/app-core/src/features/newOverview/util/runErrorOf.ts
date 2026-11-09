import { ChosenModelFailedError } from "../api/ChosenModelFailedError.js";
import type { RunError } from "../types/RunError.js";

export function runErrorOf(error: Error): RunError {
  if (error instanceof ChosenModelFailedError) return { kind: "chosenModel", provider: error.provider, model: error.model };
  return { kind: "message", message: error.message };
}
