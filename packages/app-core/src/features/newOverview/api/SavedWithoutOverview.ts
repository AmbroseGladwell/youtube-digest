import type { SavedCapture } from "@overview/domain";

// The run's other ending, not a failure: docs/features/kept-links.md, "Saving at the limit".
export class SavedWithoutOverview extends Error {
  readonly capture: SavedCapture;

  constructor(capture: SavedCapture) {
    super("Saved with its transcript, without an overview");
    this.capture = capture;
  }
}
