import test from "node:test";
import assert from "node:assert/strict";
import { OverviewId } from "./Brands.js";
import { CONNECTED_FOLLOW_UP_INSTRUCTION, followUpPrompt } from "./followUpPrompt.js";
import { makeOverview } from "./OverviewFactory.testHelper.js";

const overview = makeOverview({
  id: OverviewId.parse("e2878f61-f856-4da1-958d-c102054ab82c"),
  coreClaim: "Taste is the differentiator once AI makes building cheap.",
});
overview.source.title = "How to scale intent, quality, and artistry with AI";
const question = "Why is the editor role critical when using AI for product design?";

test("connected, the prompt names the overview for the assistant to read through The Overview, not the web", () => {
  assert.equal(
    followUpPrompt(question, overview, true),
    `${CONNECTED_FOLLOW_UP_INSTRUCTION}\n<question>${question}</question>\n` +
      "<overview>How to scale intent, quality, and artistry with AI (The Overview id e2878f61-f856-4da1-958d-c102054ab82c)</overview>",
  );
  assert.match(CONNECTED_FOLLOW_UP_INSTRUCTION, /get_overview.*get_transcript rather than searching the web/);
});

test("not connected, the prompt carries the question and the whole note", () => {
  const prompt = followUpPrompt(question, overview, false);

  assert.ok(prompt.startsWith(`<question>${question}</question>\n\n<overview>\n# How to scale intent`));
  assert.match(prompt, /Taste is the differentiator once AI makes building cheap\./);
  assert.ok(prompt.endsWith("</overview>"));
  assert.doesNotMatch(prompt, /The Overview id|get_overview/);
});
