import { randomInt } from "node:crypto";

// No look-alike characters: docs/features/sign-in.md, "Decisions, and why".
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
const LENGTH = 8;

export const generateLinkCode = (): string => {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
};

export const formatLinkCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`;

export const normaliseLinkCode = (input: string): string => {
  return input.toUpperCase().replace(/[^A-Z2-9]/g, "");
};
