// As many whole chips as fit on one line, then a "+N" for the rest (84r-2).
export const fittingChipCount = (chipWidths: readonly number[], available: number, moreWidth: number, gap: number): number => {
  let used = 0;
  for (let index = 0; index < chipWidths.length; index += 1) {
    const rest = chipWidths.length - index - 1;
    const need = (index === 0 ? 0 : gap) + chipWidths[index]! + (rest > 0 ? gap + moreWidth : 0);
    if (used + need > available) {
      return index;
    }
    used += (index === 0 ? 0 : gap) + chipWidths[index]!;
  }
  return chipWidths.length;
};
