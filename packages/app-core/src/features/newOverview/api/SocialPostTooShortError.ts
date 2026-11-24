// A photo or text post whose description is too short to write a note from (docs/features/social-posts.md).
export class SocialPostTooShortError extends Error {
  readonly words: number;

  constructor(words: number) {
    super(`The post's description has only ${words} words`);
    this.words = words;
  }
}
