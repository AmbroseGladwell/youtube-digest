import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SECTIONS_ENABLED } from "@overview/domain";
import type { ArticleGenerationInput } from "../ArticleGenerationInput.js";
import { articleHowToApplySection } from "./articleHowToApplySection.js";

const promptFor = (readerContext: string | null) =>
  articleHowToApplySection.prompt({ readerContext, sectionsEnabled: DEFAULT_SECTIONS_ENABLED } as ArticleGenerationInput);

test("a reader's context comes with the same rule videos have: fit their life, don't invent one", () => {
  const prompt = promptFor("I'm a nurse.");

  assert.match(prompt, /About the reader, for fit: I'm a nurse\./);
  assert.match(prompt, /Never give them a new\s+project, role or occasion/);
  assert.match(prompt, /Most news has nothing to apply/);
});

test("with no reader, an article has nothing to fit and no rule about it", () => {
  const prompt = promptFor(null);

  assert.doesNotMatch(prompt, /About the reader/);
  assert.doesNotMatch(prompt, /Never give them a new/);
});
