export const countWords = (text: string): number => {
  return text.trim().split(/\s+/).filter(Boolean).length;
};
