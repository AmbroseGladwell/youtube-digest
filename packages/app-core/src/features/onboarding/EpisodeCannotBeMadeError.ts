// Your link says why in place of Looks right, so the run stops there rather than failing (327w-3).
export class EpisodeCannotBeMadeError extends Error {
  constructor() {
    super("This episode can't be transcribed, and has no transcript");
    this.name = "EpisodeCannotBeMadeError";
  }
}
