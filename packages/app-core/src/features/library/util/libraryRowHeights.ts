const heightsByWidth = new Map<number, Map<string, number>>();

export const libraryRowHeights = (listWidth: number): Map<string, number> => {
  const width = Math.round(listWidth);
  let heights = heightsByWidth.get(width);
  if (heights === undefined) {
    heights = new Map();
    heightsByWidth.set(width, heights);
  }
  return heights;
};
