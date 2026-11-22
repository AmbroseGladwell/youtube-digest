import { z } from "zod";

export const EMBEDDING = {
  model: "text-embedding-3-small",
  dollarsPerMillionTokens: 0.02,
  checkedOn: "2026-11-09",
} as const;

const EmbeddingsResponse = z.object({
  data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) })),
  usage: z.object({ total_tokens: z.number() }),
});

const BATCH = 256;

export interface Embedded {
  vectors: number[][];
  tokens: number;
}

export async function embedTexts(apiKey: string, texts: readonly string[]): Promise<Embedded> {
  const vectors: number[][] = [];
  let tokens = 0;
  for (let start = 0; start < texts.length; start += BATCH) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING.model, input: texts.slice(start, start + BATCH) }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(`OpenAI embeddings answered ${response.status}: ${await response.text()}`);
    }
    const parsed = EmbeddingsResponse.parse(await response.json());
    tokens += parsed.usage.total_tokens;
    vectors.push(...parsed.data.sort((left, right) => left.index - right.index).map((item) => item.embedding));
  }
  return { vectors, tokens };
}

export const embeddingDollars = (tokens: number): number => (tokens * EMBEDDING.dollarsPerMillionTokens) / 1_000_000;
