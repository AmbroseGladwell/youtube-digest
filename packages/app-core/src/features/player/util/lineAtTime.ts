export const lineAtTime = (lineStarts: readonly number[], seconds: number): number => {
  let low = 0;
  let high = lineStarts.length - 1;
  let found = 0;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lineStarts[middle]! <= seconds) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
};

export const nearestLineStart = (lineStarts: readonly number[], seconds: number): number => {
  let nearest = 0;
  lineStarts.forEach((start, index) => {
    if (Math.abs(start - seconds) < Math.abs(lineStarts[nearest]! - seconds)) {
      nearest = index;
    }
  });
  return nearest;
};
