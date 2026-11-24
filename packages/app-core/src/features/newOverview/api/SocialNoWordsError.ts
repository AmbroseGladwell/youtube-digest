// A video with no words to find and none we can transcribe, found before anything was spent.
export class SocialNoWordsError extends Error {
  constructor() {
    super("The video has no words, and none can be transcribed");
  }
}
