export interface Embedding {
  vectors: number[][];
  tokens: number;
}

// One model's vectors are only comparable with its own, so every stored vector carries the
// model that made it (docs/features/search-by-meaning.md, "Changing the model").
export interface Embedder {
  model: string;
  dimensions: number;
  dollarsPerMillionTokens: number;
  embed(texts: string[]): Promise<Embedding>;
}
