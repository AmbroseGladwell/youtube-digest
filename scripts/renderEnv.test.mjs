import test from "node:test";
import assert from "node:assert/strict";
import { renderEnvTemplate } from "./renderEnv.mjs";

test("a placeholder becomes the variable's value, in its quotes, and everything else passes through", () => {
  const { rendered, missing, unquoted, unquotable } = renderEnvTemplate('A=1\nKEY="${SECRET_KEY}"\n# ${NOT_A_PLACEHOLDER', {
    SECRET_KEY: "s3cret",
  });
  assert.equal(rendered, 'A=1\nKEY="s3cret"\n# ${NOT_A_PLACEHOLDER');
  assert.deepEqual([missing, unquoted, unquotable], [[], [], []]);
});

test("a variable that is absent or empty is reported by name, once", () => {
  const { missing } = renderEnvTemplate('A="${ONE}"\nB="${TWO}"\nC="${ONE}"', { TWO: "" });
  assert.deepEqual(missing, ["ONE", "TWO"]);
});

test("a placeholder outside double quotes is refused, since a value starting with # would be lost", () => {
  const { unquoted } = renderEnvTemplate("A=${ONE}\nB='${TWO}'\nC=\"${THREE}\"", { ONE: "#1", TWO: "2", THREE: "3" });
  assert.deepEqual(unquoted, ["ONE", "TWO"]);
});

test("a value with a #, kept in its quotes, renders as it is", () => {
  const { rendered, unquotable } = renderEnvTemplate('S="${SECRET}"', { SECRET: "#ab#c^$d" });
  assert.equal(rendered, 'S="#ab#c^$d"');
  assert.deepEqual(unquotable, []);
});

test("a value the quotes cannot carry intact is refused by name", () => {
  const { unquotable } = renderEnvTemplate('A="${ONE}"\nB="${TWO}"\nC="${THREE}"\nD="${FOUR}"', {
    ONE: 'a"b',
    TWO: "a\\nb",
    THREE: "a\nb",
    FOUR: "fine",
  });
  assert.deepEqual(unquotable, ["ONE", "TWO", "THREE"]);
});
