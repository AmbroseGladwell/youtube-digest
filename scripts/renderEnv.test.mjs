import test from "node:test";
import assert from "node:assert/strict";
import { renderEnvTemplate } from "./renderEnv.mjs";

test("a placeholder becomes the variable's value and everything else passes through", () => {
  const { rendered, missing } = renderEnvTemplate("A=1\nKEY=${SECRET_KEY}\n# ${NOT_A_PLACEHOLDER", {
    SECRET_KEY: "s3cret",
  });
  assert.equal(rendered, "A=1\nKEY=s3cret\n# ${NOT_A_PLACEHOLDER");
  assert.deepEqual(missing, []);
});

test("a variable that is absent or empty is reported by name, once", () => {
  const { missing } = renderEnvTemplate("A=${ONE}\nB=${TWO}\nC=${ONE}", { TWO: "" });
  assert.deepEqual(missing, ["ONE", "TWO"]);
});
