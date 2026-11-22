export interface Embedding {
  vectors: number[][];
  tokens: number;
}

// Every vector names its model: docs/features/search-by-meaning.md, "Storage".
export interface Embedder {
  model: string;
  dimensions: number;
  dollarsPerMillionTokens: number;
  embed(texts: string[]): Promise<Embedding>;
}
