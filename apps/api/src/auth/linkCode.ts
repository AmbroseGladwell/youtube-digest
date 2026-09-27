import { randomInt } from "node:crypto";

// No 0, O, 1, I or L, so a code read off a screen and typed into a side panel has no
// two characters that look alike (docs/features/sign-in.md).
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const LENGTH = 8;

export function generateLinkCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export const formatLinkCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`;

export function normaliseLinkCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, "");
}
