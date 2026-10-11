export class GenerationError extends Error {}

// Told apart from every other failure because the screen that reports it is different: a
// refused key keeps the reader on the row they are filling in, with the key still in the
// field (design 110f). Anything else is a generation that failed.
export class ProviderKeyRefusedError extends GenerationError {}

export class ProviderRequestError extends GenerationError {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function providerFailure(status: number, body: string): GenerationError {
  const detail = body.slice(0, 500);
  // 401 is the common refusal; 403 is a key that exists but is not allowed to do this, and
  // reads the same way to a reader holding it.
  return status === 401 || status === 403
    ? new ProviderKeyRefusedError(detail)
    : new ProviderRequestError(status, detail);
}
