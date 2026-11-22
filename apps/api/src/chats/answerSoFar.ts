const escapeStepAt = (partialJson: string, at: number): number => {
  if (partialJson[at] !== "\\") {
    return 1;
  }
  return partialJson[at + 1] === "u" ? 6 : 2;
};

const openingOf = (field: string) => new RegExp(String.raw`^\s*\{\s*"${field}"\s*:\s*"`);

export const answerSoFar = (partialJson: string, field = "answer"): string => {
  const opening = openingOf(field).exec(partialJson);
  if (opening === null) {
    return "";
  }
  const start = opening[0].length;
  let end = start;
  while (end < partialJson.length && partialJson[end] !== '"') {
    const step = escapeStepAt(partialJson, end);
    if (end + step > partialJson.length) {
      break;
    }
    end += step;
  }
  try {
    return JSON.parse(`"${partialJson.slice(start, end)}"`) as string;
  } catch {
    return "";
  }
};
