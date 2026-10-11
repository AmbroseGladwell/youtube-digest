import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { providerJsonSchema, type JsonSchema } from "./providerJsonSchema.js";

// The schemas here are nested a few levels and every lookup is an index access, so one
// reader that fails loudly beats a hundred non-null assertions.
function at(schema: JsonSchema, ...path: string[]): JsonSchema {
  let node = schema;
  for (const step of path) {
    const next = step === "items" ? node.items : (node.properties as JsonSchema | undefined)?.[step];
    assert.ok(next !== undefined && typeof next === "object", `no ${path.join(".")} in ${JSON.stringify(schema)}`);
    node = next as JsonSchema;
  }
  return node;
}

test("every object is closed and every property required, which is what strict mode asks for", () => {
  const schema = providerJsonSchema(z.object({ a: z.string(), b: z.object({ c: z.number() }) }));

  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["a", "b"]);
  assert.equal(at(schema, "b").additionalProperties, false);
  assert.deepEqual(at(schema, "b").required, ["c"]);
});

test("a cap no provider enforces is not dropped, it is said in the description", () => {
  const schema = providerJsonSchema(z.object({ points: z.array(z.string()).max(7) }));

  assert.equal(at(schema, "points").maxItems, undefined);
  assert.match(String(at(schema, "points").description), /maxItems: 7/);
});

test("a cap said in words keeps the words the section already wrote", () => {
  const schema = providerJsonSchema(
    z.object({ points: z.array(z.string()).max(7).describe("Three to five, seven at the very most.") }),
  );

  const description = String(at(schema, "points").description);
  assert.match(description, /Three to five/);
  assert.match(description, /maxItems: 7/);
});

test("an enum survives as an enum rather than becoming prose", () => {
  const schema = providerJsonSchema(z.object({ novelty: z.enum(["common_knowledge", "original"]) }));

  assert.deepEqual(at(schema, "novelty").enum, ["common_knowledge", "original"]);
});

test("a nullable object becomes a choice of shapes, which is what the optional sections are", () => {
  const schema = providerJsonSchema(z.object({ verdict: z.object({ reason: z.string() }).nullable() }));

  assert.equal(Array.isArray(at(schema, "verdict").anyOf), true);
  assert.equal(at(schema, "verdict").type, undefined);
});

test("the bounds a number picks up on the way through are not sent, because strict mode refuses them", () => {
  const schema = providerJsonSchema(z.object({ index: z.number().int().min(0) }));

  assert.equal(at(schema, "index").minimum, undefined);
  assert.equal(at(schema, "index").type, "integer");
});

test("an array's items are transformed too, not left as zod wrote them", () => {
  const schema = providerJsonSchema(z.object({ points: z.array(z.object({ text: z.string().max(40) })) }));

  assert.equal(at(schema, "points", "items").additionalProperties, false);
  assert.equal(at(schema, "points", "items", "text").maxLength, undefined);
  assert.match(String(at(schema, "points", "items", "text").description), /maxLength: 40/);
});
