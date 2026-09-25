export const wordCount = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
