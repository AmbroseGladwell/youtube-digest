// The check found an episode that can't be transcribed and has no words (327w-3, 327w-4): Your link
// says why in place of Looks right, so the run stops there rather than failing.
export class EpisodeCannotBeMadeError extends Error {
  constructor() {
    super("This episode can't be transcribed, and has no transcript");
    this.name = "EpisodeCannotBeMadeError";
  }
}
