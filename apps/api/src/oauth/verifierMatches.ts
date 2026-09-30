import { createHash, timingSafeEqual } from "node:crypto";

const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
export const S256_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export const s256Challenge = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

export function verifierMatches(verifier: string, challenge: string): boolean {
  if (!VERIFIER.test(verifier)) {
    return false;
  }
  const expected = Buffer.from(s256Challenge(verifier));
  const actual = Buffer.from(challenge);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
