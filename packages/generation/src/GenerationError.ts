export class GenerationError extends Error {}

// Its own class: a refused key keeps the reader on its row, the key still in the field (design 110f).
export class ProviderKeyRefusedError extends GenerationError {}

export class ProviderRequestError extends GenerationError {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Each provider says it its own way: docs/architecture/tiers.md, "Which key an overview uses".
export class ProviderOutOfCreditError extends ProviderRequestError {}

// Not a provider that is down: a reader's own key may name any model its provider lists (OV-247).
export class ModelRefusedError extends ProviderRequestError {}

export class SchemaFailureError extends GenerationError {}

// A timeout and a rate limit say nothing about the model, so neither is a refusal of it.
const refusesModel = (status: number): boolean => status >= 400 && status < 500 && status !== 408 && status !== 429;

// OpenAI: 429 insufficient_quota; Anthropic: 400 about the credit balance; DeepSeek and the rest: 402.
const outOfCredit = (status: number, body: string): boolean =>
  status === 402 || (status === 429 && body.includes("insufficient_quota")) || (status === 400 && /credit balance is too low/i.test(body));

export const providerFailure = (status: number, body: string): GenerationError => {
  const detail = body.slice(0, 500);
  // 403 is a key that exists but isn't allowed this, which reads the same way to the reader holding it.
  if (status === 401 || status === 403) {
    return new ProviderKeyRefusedError(detail);
  }
  if (outOfCredit(status, body)) {
    return new ProviderOutOfCreditError(status, detail);
  }
  if (refusesModel(status)) {
    return new ModelRefusedError(status, detail);
  }
  return new ProviderRequestError(status, detail);
};
