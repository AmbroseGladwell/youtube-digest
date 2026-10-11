import { z } from "zod";

export type JsonSchema = Record<string, unknown>;

// What every provider's structured-output mode agrees on. Everything else a Zod schema
// produces — the caps, the bounds, the string formats — is unsupported by at least one of
// them, and sending it is a 400 rather than a stricter model.
const KEPT = new Set(["type", "description", "enum", "const"]);

const isObject = (value: unknown): value is JsonSchema =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The leftovers are not dropped, they are said in words. docs/features/overview-generation-decisions.md
// records that this is already how the array cap reaches the model: structured outputs do
// not enforce it, the prompt and the correction pass do. Keeping the behaviour identical
// across six providers is the point — the overview format was tuned against a model that
// could read its own caps in the description.
function describeUnsupported(schema: JsonSchema, leftovers: JsonSchema): void {
  const entries = Object.entries(leftovers);
  if (entries.length === 0) {
    return;
  }
  const said = `{${entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")}}`;
  const existing = schema.description;
  schema.description = typeof existing === "string" ? `${existing}\n\n${said}` : said;
}

function transform(node: unknown): JsonSchema {
  if (!isObject(node)) {
    return {};
  }

  const { anyOf, oneOf, allOf, properties, required, items, additionalProperties: _ignored, ...rest } = node;
  const out: JsonSchema = {};
  const leftovers: JsonSchema = {};

  for (const [key, value] of Object.entries(rest)) {
    if (KEPT.has(key)) {
      out[key] = value;
    } else {
      leftovers[key] = value;
    }
  }

  const branches = anyOf ?? oneOf;
  if (Array.isArray(branches)) {
    out.anyOf = branches.map(transform);
    delete out.type;
  } else if (Array.isArray(allOf)) {
    out.allOf = allOf.map(transform);
    delete out.type;
  }

  if (node.type === "object") {
    out.properties = Object.fromEntries(
      Object.entries(isObject(properties) ? properties : {}).map(([key, value]) => [key, transform(value)]),
    );
    // Required everywhere and nothing extra: OpenAI's strict mode refuses a schema that
    // leaves either open, and the others are content with it. A field that may be absent
    // is already modelled as a nullable one throughout the prompt sections.
    out.required = Array.isArray(required) ? required : Object.keys(out.properties as JsonSchema);
    out.additionalProperties = false;
  }

  if (node.type === "array" && items !== undefined) {
    out.items = transform(items);
  }

  describeUnsupported(out, leftovers);
  return out;
}

// One shape for all five providers that accept a schema. The sixth, DeepSeek, has no
// schema mode at all and is given this same object inside the prompt instead
// (docs/features/byo-providers.md).
export function providerJsonSchema(schema: z.ZodObject<z.ZodRawShape>): JsonSchema {
  return transform(z.toJSONSchema(schema, { io: "output" }));
}
