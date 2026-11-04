export interface TemperaturePiece {
  text: string;
  converted: boolean;
}

const CELSIUS = /(?<![\p{L}\d.])(\d{2,3})\s?[°º]?\s?C(?![\p{L}\d])/gu;
const OVEN_FROM_CELSIUS = 120;
const DIAL_STEP = 25;

const fahrenheit = (celsius: number): number => {
  const exact = (celsius * 9) / 5 + 32;
  return celsius >= OVEN_FROM_CELSIUS ? Math.round(exact / DIAL_STEP) * DIAL_STEP : Math.round(exact);
};

// US units turn the method's Celsius into Fahrenheit, fan figures included, and nothing else in
// it (design 150ak, owner 3 Nov 2026). Oven figures land on the 25° marks of a dial, as the usual
// tables do: 180°C is 350°F, 220°C is 425°F. Arithmetic in code, never a model's guess.
export function usOvenTemperatures(text: string): TemperaturePiece[] {
  const pieces: TemperaturePiece[] = [];
  let from = 0;
  for (const match of text.matchAll(CELSIUS)) {
    if (match.index > from) pieces.push({ text: text.slice(from, match.index), converted: false });
    pieces.push({ text: `${fahrenheit(Number(match[1]))}°F`, converted: true });
    from = match.index + match[0].length;
  }
  if (from < text.length) pieces.push({ text: text.slice(from), converted: false });
  return pieces;
}

export const inUsOvenTemperatures = (text: string): string =>
  usOvenTemperatures(text)
    .map((piece) => piece.text)
    .join("");
