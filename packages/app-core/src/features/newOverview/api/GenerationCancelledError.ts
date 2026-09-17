export class GenerationCancelledError extends Error {
  constructor() {
    super("Generation was cancelled.");
    this.name = "GenerationCancelledError";
  }
}
