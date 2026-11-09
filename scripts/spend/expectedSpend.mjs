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
  { provider: "cloudflare", environment: "prod", area: "storage" },
  { provider: "cloudflare", environment: "dev", area: "storage" },
];

export const spendKey = ({ provider, environment, area }) => `${provider}/${environment}/${area}`;
