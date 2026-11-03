import test from "node:test";
import assert from "node:assert/strict";
import { generateForAnyoneSteps } from "./generateForAnyoneSteps.js";
import { GenerationError } from "./GenerationError.js";

const INPUT = { title: "Knife skills", channel: "A cook", inOneLine: "Hold it right.", coreClaim: "Grip matters.", keyPoints: ["The claw grip."] };

test("it asks with no reader in the prompt, from the note and no transcript", async () => {
  let system = "";
  let user = "";
  const items = await generateForAnyoneSteps(async ({ systemPrompt, userMessage }) => {
    system = systemPrompt;
    user = userMessage;
    return { items: ["Practise the claw grip on one onion a day."] };
  }, INPUT);

  assert.deepEqual(items, ["Practise the claw grip on one onion a day."]);
  assert.doesNotMatch(system, /About the reader/);
  assert.match(user, /- The claw grip\./);
});

test("more than three steps fail their schema", async () => {
  await assert.rejects(() => generateForAnyoneSteps(async () => ({ items: ["a", "b", "c", "d"] }), INPUT), GenerationError);
});
