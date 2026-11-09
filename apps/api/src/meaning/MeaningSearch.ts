import type { AccountId } from "../auth/AccountId.js";
import type { ClaimEmbeddingsRepository, MeaningMatch } from "./ClaimEmbeddingsRepository.js";
import type { Embedder } from "./Embedder.js";

// No similarity separates a right match from a wrong one cleanly (OV-229's spike), so this
// only drops what is plainly unrelated; the closest few are what a reader is shown.
export const MEANING_FLOOR = 0.3;
const CANDIDATES = 50;
const CACHED_QUERIES = 500;

export type MeaningResult = { available: true; matches: MeaningMatch[] } | { available: false };

// Searches repeat, so a query's vector is kept rather than paid for again.
export class MeaningSearch {
  #embeddings: ClaimEmbeddingsRepository;
  #embedder: Embedder;
  #cache = new Map<string, number[]>();

  constructor(embeddings: ClaimEmbeddingsRepository, embedder: Embedder) {
    this.#embeddings = embeddings;
    this.#embedder = embedder;
  }

  async search(accountId: AccountId, query: string): Promise<MeaningResult> {
    const text = query.trim().toLowerCase();
    if (text === "") {
      return { available: true, matches: [] };
    }
    let vector: number[];
    try {
      vector = await this.#vectorOf(text);
    } catch {
      return { available: false };
    }
    const matches = await this.#embeddings.closest(accountId, vector, this.#embedder.model, CANDIDATES);
    return { available: true, matches: matches.filter((match) => match.similarity >= MEANING_FLOOR) };
  }

  async #vectorOf(text: string): Promise<number[]> {
    const cached = this.#cache.get(text);
    if (cached !== undefined) {
      this.#cache.delete(text);
      this.#cache.set(text, cached);
      return cached;
    }
    const { vectors } = await this.#embedder.embed([text]);
    const vector = vectors[0]!;
    this.#cache.set(text, vector);
    if (this.#cache.size > CACHED_QUERIES) {
      this.#cache.delete(this.#cache.keys().next().value!);
    }
    return vector;
  }
}
