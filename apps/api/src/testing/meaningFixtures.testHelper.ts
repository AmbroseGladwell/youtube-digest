import type { Overview } from "@overview/domain";
import { makeConceptEmbedder, type ConceptEmbedder } from "../meaning/ConceptEmbedder.testHelper.js";
import { storedOverview } from "./storedRecords.testHelper.js";

// Two ideas, each spelled in words the other notes never use: the vocabulary case OV-229 is for.
export const conceptEmbedder = (): ConceptEmbedder =>
  makeConceptEmbedder([
    ["founders", "clinging", "stagnation", "succession", "overstay", "leaders", "entrenched", "decline"],
    ["sourdough", "proving", "loaf", "starter", "dough", "baking", "bread"],
  ]);

export const noteAbout = (coreClaim: string, points: string[], overrides: Partial<Overview> = {}) =>
  storedOverview({ coreClaim, keyPoints: points.map((text) => ({ text, range: null })), ...overrides });

export const foundersNote = () =>
  noteAbout("Founders clinging to control cause organisational stagnation", [
    "Succession planning is avoided for years",
    "Boards rarely push back",
    "Growth slows once that happens",
  ]);

export const breadNote = () =>
  noteAbout("A sourdough loaf needs a slow overnight proving", [
    "Feed the starter the night before",
    "Keep the dough warm",
    "Bake in a lidded pot",
  ]);
