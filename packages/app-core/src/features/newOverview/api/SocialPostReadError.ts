import type { SocialReadFailure } from "@overview/domain";

// Read for its card, before anything was spent on writing it.
export class SocialPostReadError extends Error {
  readonly reason: SocialReadFailure;

  constructor(reason: SocialReadFailure) {
    super(`The post could not be read: ${reason}`);
    this.reason = reason;
  }
}
