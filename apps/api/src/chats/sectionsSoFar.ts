export const sectionsSoFar = (partialJson: string): unknown[] => {
  const key = partialJson.search(/"sections"\s*:\s*\[/);
  if (key === -1) {
    return [];
  }
  let at = partialJson.indexOf("[", key) + 1;
  const sections: unknown[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  for (; at < partialJson.length; at += 1) {
    const char = partialJson[at];
    if (inString) {
      if (char === "\\") {
        at += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      if (depth === 0) {
        start = at;
      }
      depth += 1;
    } else if (char === "}" || char === "]") {
      if (depth === 0) {
        break;
      }
      depth -= 1;
      if (depth === 0 && start !== -1) {
        sections.push(JSON.parse(partialJson.slice(start, at + 1)));
        start = -1;
      }
    }
  }
  return sections;
};
