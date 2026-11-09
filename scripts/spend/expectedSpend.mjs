export const ENVIRONMENTS = ["prod", "dev", "evals"];

export const EXPECTED_SPEND = [
  { provider: "openai", environment: "prod", area: "generation" },
  { provider: "openai", environment: "prod", area: "embeddings" },
  { provider: "openai", environment: "dev", area: "generation" },
  { provider: "openai", environment: "dev", area: "embeddings" },
  { provider: "openai", environment: "evals", area: "generation" },
  { provider: "anthropic", environment: "evals", area: "generation" },
  { provider: "gemini", environment: "evals", area: "generation" },
  { provider: "decodo", environment: "prod", area: "transcripts" },
  { provider: "neon", environment: "prod", area: "database" },
  { provider: "fly", environment: "prod", area: "servers" },
  { provider: "fly", environment: "prod", area: "narration" },
  { provider: "cloudflare", environment: "unsplit", area: "storage" },
];

export const ENTERED_BY_HAND = {
  anthropic: "an individual Anthropic account has no cost API: enter a monthly figure",
  gemini: "Gemini's cost needs a Google Cloud billing export: enter a monthly figure",
  decodo: "Decodo reports traffic, not cost: enter the plan's fee",
  neon: "the free plan has no cost API: enter the plan's fee",
  fly: "Fly.io has no cost API: enter a monthly figure",
};

export const spendKey = ({ provider, environment, area }) => `${provider}/${environment}/${area}`;
