import { z } from "zod";
import type { Embedder } from "./Embedder.js";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
const BATCH = 256;

const EmbeddingsResponse = z.object({
  data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) })),
  usage: z.object({ total_tokens: z.number() }),
});

export class EmbedderError extends Error {}

// OV-229 chose OpenAI's small model after measuring it against two open models on a real
// library (docs/features/search-by-meaning.md, "Why OpenAI").
export function createOpenAiEmbedder({ apiKey, http }: { apiKey: string; http: typeof fetch }): Embedder {
  return {
    model: EMBEDDING_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    async embed(texts) {
      const vectors: number[][] = [];
      let tokens = 0;
      for (let start = 0; start < texts.length; start += BATCH) {
        const response = await http("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts.slice(start, start + BATCH) }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) {
          throw new EmbedderError(`OpenAI embeddings answered ${response.status}`);
        }
        const parsed = EmbeddingsResponse.parse(await response.json());
        tokens += parsed.usage.total_tokens;
        vectors.push(...parsed.data.sort((left, right) => left.index - right.index).map((item) => item.embedding));
      }
      return { vectors, tokens };
    },
  };
}
