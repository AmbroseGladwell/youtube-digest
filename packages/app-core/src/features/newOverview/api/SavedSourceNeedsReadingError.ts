// A page, or a saved source whose words aren't on this device: it is read again through Create.
export class SavedSourceNeedsReadingError extends Error {
  constructor() {
    super("This saved source has to be read again before its overview can be written");
  }
}
