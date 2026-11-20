const openingOf = (field: string) => new RegExp(String.raw`^\s*\{\s*"${field}"\s*:\s*"`);

// The text of a reply's first field (its answer, or a sectioned answer's intro) while the reply
// still arrives as JSON, up to the last character that is certainly whole: an escape cut in half
// waits for the next chunk.
export function answerSoFar(partialJson: string, field = "answer"): string {
  const opening = openingOf(field).exec(partialJson);
  if (opening === null) return "";
  const start = opening[0].length;
  let end = start;
  while (end < partialJson.length && partialJson[end] !== '"') {
    const step = partialJson[end] !== "\\" ? 1 : partialJson[end + 1] === "u" ? 6 : 2;
    if (end + step > partialJson.length) break;
    end += step;
  }
  try {
    return JSON.parse(`"${partialJson.slice(start, end)}"`) as string;
  } catch {
    return "";
  }
}
