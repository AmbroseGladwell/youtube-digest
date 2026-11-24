import type { OverviewId, SourceKey } from "./Brands.js";
import type { Capture } from "./Capture.js";

export interface CaptureStore {
  // Oldest first, live ones only.
  listCaptures(): Promise<Capture[]>;
  getCapture(id: OverviewId): Promise<Capture | null>;
  captureOfSource(key: SourceKey): Promise<Capture | null>;
  saveCapture(capture: Capture): Promise<void>;
  removeCapture(id: OverviewId): Promise<void>;
}
