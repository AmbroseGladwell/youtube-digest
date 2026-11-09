import { test } from "node:test";
import assert from "node:assert/strict";
import { compareSecretProjects, formatComparison } from "./compareSecretProjects.mjs";

const projects = {
  "overview-dev": [
    { key: "OPENAI_API_KEY", value: "dev-openai" },
    { key: "BREVO_API_KEY", value: "same-brevo" },
  ],
  "overview-prod": [
    { key: "OPENAI_API_KEY", value: "prod-openai" },
    { key: "BREVO_API_KEY", value: "same-brevo" },
  ],
  "overview-evals": [{ key: "OPENAI_API_KEY", value: "evals-openai" }],
};

test("a key with one value in two projects is shared, and distinct values get distinct letters", () => {
  assert.deepEqual(compareSecretProjects(projects), [
    { key: "BREVO_API_KEY", labels: ["A", "A", "-"], shared: true },
    { key: "OPENAI_API_KEY", labels: ["A", "B", "C"], shared: false },
  ]);
});

test("a key held by one project alone is never shared", () => {
  const [row] = compareSecretProjects({ a: [{ key: "GEMINI_API_KEY", value: "x" }], b: [] });
  assert.deepEqual(row, { key: "GEMINI_API_KEY", labels: ["A", "-"], shared: false });
});

test("the printed table carries letters and the shared flag, never a value or a digest", () => {
  const printed = formatComparison(Object.keys(projects), compareSecretProjects(projects));
  for (const secret of Object.values(projects).flat()) assert.ok(!printed.includes(secret.value));
  assert.match(printed, /BREVO_API_KEY\s+A\s+A\s+-\s+SHARED/);
  assert.doesNotMatch(printed, /[0-9a-f]{16}/);
});
