import test from "node:test";
import assert from "node:assert/strict";
import { chatSystemPrompt } from "./chatPrompt.js";

const PASSAGES = [{ id: "p1", startMs: 0, endMs: 8_000, text: "Creatine is a backup store of energy." }];
const READER = "I'm a dad, and right now I'm focusing on sleep.";

test("with nothing known about the reader, the prompt says so and points to Settings, the same for every reader", () => {
  for (const kind of ["video", "episode", "article", "recipe"] as const) {
    const prompt = chatSystemPrompt(kind, "# Overview", PASSAGES, { reader: null });

    assert.equal(prompt, chatSystemPrompt(kind, "# Overview", PASSAGES));
    assert.match(prompt, /\n\n# The reader\n\nNothing is known about the reader yet/);
    assert.ok(prompt.endsWith("so answers and How to apply fit them."));
  }
});

test("the reader comes last, after the transcript, so a changed profile leaves the cached transcript whole", () => {
  const without = chatSystemPrompt("video", "# Overview", PASSAGES);
  const prompt = chatSystemPrompt("video", "# Overview", PASSAGES, { reader: READER });
  const shared = without.slice(0, without.lastIndexOf("\n\n# The reader\n"));

  assert.ok(prompt.startsWith(`${shared}\n\n# The reader\n\nWhat The Overview knows`));
  assert.ok(!prompt.includes("Nothing is known"));
  assert.ok(prompt.endsWith("Settings › Personalisation."));
  assert.ok(prompt.includes(`\n\n${READER}\n\n`));
  assert.match(prompt, /never say the video says something because it fits them/);
});

test("a page answered from its overview alone is fitted to the reader too", () => {
  const prompt = chatSystemPrompt("recipe", "# Overview", [], { reader: READER });

  const without = chatSystemPrompt("recipe", "# Overview", []);
  assert.ok(prompt.startsWith(without.slice(0, without.lastIndexOf("\n\n# The reader\n"))));
  assert.match(prompt, /never say the recipe page says something because it fits them/);
});

test("every prompt says what chat can't do, and where the reader changes what The Overview knows about them", () => {
  for (const kind of ["video", "episode", "article", "recipe"] as const) {
    const prompt = chatSystemPrompt(kind, "# Overview", PASSAGES);

    assert.match(prompt, /You can't see images or files, open links, search the web, read the rest of their library/);
    assert.match(prompt, /About you sentence they write in onboarding or in Settings › Personalisation/);
    assert.ok(prompt.indexOf("\n# The Overview\n") < prompt.indexOf("\n# The overview\n"));
  }
});

test("similar overviews are named as the reader's own, except on a recipe, which has no verdict", () => {
  assert.match(
    chatSystemPrompt("episode", "# Overview", PASSAGES),
    /Similar overviews in the reader's library, under the verdict, are other overviews the reader saved/,
  );
  assert.match(chatSystemPrompt("article", "# Overview", []), /Similar overviews in the reader's library/);
  assert.doesNotMatch(chatSystemPrompt("recipe", "# Overview", []), /Similar overviews/);
  assert.doesNotMatch(chatSystemPrompt("video", "# Overview", PASSAGES, { recipe: true }), /Similar overviews|How to apply is fitted/);
});

test("only a source with a transcript mentions one among what chat has", () => {
  assert.match(
    chatSystemPrompt("video", "# Overview", PASSAGES),
    /typed messages, this overview, the video's transcript, and their other conversations/,
  );
  assert.match(chatSystemPrompt("article", "# Overview", []), /typed messages, this overview, and their other conversations/);
});
