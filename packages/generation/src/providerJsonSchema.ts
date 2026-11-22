import { z } from "zod";

export type JsonSchema = Record<string, unknown>;

// Everything else is unsupported by at least one provider, and sending it is a 400.
const KEPT = new Set(["type", "description", "enum", "const"]);

const isObject = (value: unknown): value is JsonSchema => typeof value === "object" && value !== null && !Array.isArray(value);

// docs/features/byo-providers.md, "The schema is the same object for all five, and words for the sixth".
const describeUnsupported = (schema: JsonSchema, leftovers: JsonSchema): void => {
  const entries = Object.entries(leftovers);
  if (entries.length === 0) {
    return;
  }
  const said = `{${entries.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join(", ")}}`;
  const existing = schema.description;
  schema.description = typeof existing === "string" ? `${existing}\n\n${said}` : said;
};

const transform = (node: unknown): JsonSchema => {
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
    // OpenAI's strict mode refuses a schema that leaves either open.
    out.required = Array.isArray(required) ? required : Object.keys(out.properties as JsonSchema);
    out.additionalProperties = false;
  }

  if (node.type === "array" && items !== undefined) {
    out.items = transform(items);
  }

  describeUnsupported(out, leftovers);
  return out;
};

// docs/features/byo-providers.md, "The schema is the same object for all five, and words for the sixth".
export const providerJsonSchema = (schema: z.ZodObject<z.ZodRawShape>): JsonSchema => {
  return transform(z.toJSONSchema(schema, { io: "output" }));
};
