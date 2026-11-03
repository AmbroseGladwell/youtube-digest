export type JsonObject = Record<string, unknown>;

export const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

const flattened = (value: unknown): JsonObject[] => {
  if (Array.isArray(value)) return value.flatMap(flattened);
  if (!isObject(value)) return [];
  return [value, ...flattened(value["@graph"])];
};

export const typesOf = (node: JsonObject): string[] => {
  const type = node["@type"];
  return (Array.isArray(type) ? type : [type]).filter((entry): entry is string => typeof entry === "string");
};

export function linkedData(document: Document): JsonObject[] {
  return [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
    try {
      return flattened(JSON.parse(script.textContent ?? ""));
    } catch {
      return [];
    }
  });
}
