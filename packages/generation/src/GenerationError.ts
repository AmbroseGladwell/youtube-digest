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

// A key the provider accepts, on an account with nothing left to spend. Each provider says
// so its own way, so it is told apart here rather than read from a status alone
// (docs/architecture/tiers.md, "Which key an overview uses").
export class ProviderOutOfCreditError extends ProviderRequestError {}

// The model's answer still broke the schema after its one corrective retry.
export class SchemaFailureError extends GenerationError {}

// OpenAI answers 429 with `insufficient_quota`; Anthropic answers 400 with a message about
// the credit balance; DeepSeek, and anything else that uses it, 402 Payment Required.
const outOfCredit = (status: number, body: string): boolean =>
  status === 402 ||
  (status === 429 && body.includes("insufficient_quota")) ||
  (status === 400 && /credit balance is too low/i.test(body));

export function providerFailure(status: number, body: string): GenerationError {
  const detail = body.slice(0, 500);
  // 401 is the common refusal; 403 is a key that exists but is not allowed to do this, and
  // reads the same way to a reader holding it.
  if (status === 401 || status === 403) return new ProviderKeyRefusedError(detail);
  if (outOfCredit(status, body)) return new ProviderOutOfCreditError(status, detail);
  return new ProviderRequestError(status, detail);
}
