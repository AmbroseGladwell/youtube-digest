import { EMBEDDING_DIMENSIONS } from "./createOpenAiEmbedder.js";
import type { Embedder } from "./Embedder.js";

export interface ConceptEmbedder extends Embedder {
  calls: string[][];
  failing: boolean;
}

const CONCEPT_DIMENSIONS = 100;
const words = (text: string) => text.toLowerCase().match(/[a-z]+/g) ?? [];

function slot(word: string): number {
  let hash = 0;
  for (const letter of word) hash = (hash * 31 + letter.charCodeAt(0)) % 1_000_003;
  return CONCEPT_DIMENSIONS + (hash % (EMBEDDING_DIMENSIONS - CONCEPT_DIMENSIONS));
}

// A stand-in for a real model: each group of words is one idea, so texts that share an idea
// and no word land close together, and any other word only adds a little of its own.
export function makeConceptEmbedder(concepts: string[][]): ConceptEmbedder {
  const embedder: ConceptEmbedder = {
    model: "concept-test",
    dollarsPerMillionTokens: 0.02,
    dimensions: EMBEDDING_DIMENSIONS,
    calls: [],
    failing: false,
    async embed(texts) {
      embedder.calls.push(texts);
      if (embedder.failing) {
        throw new Error("The embedding service is down");
      }
      const vectors = texts.map((text) => {
        const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
        for (const word of words(text)) {
          const concept = concepts.findIndex((group) => group.includes(word));
          if (concept === -1) {
            vector[slot(word)]! += 0.1;
          } else {
            vector[concept]! += 1;
          }
        }
        return vector;
      });
      return { vectors, tokens: texts.reduce((total, text) => total + words(text).length, 0) };
    },
  };
  return embedder;
}
