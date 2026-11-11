// A watch-anyway reason may say the note covers the video. It may not count or time it: a model
// can't measure, and "four simple instructions" or "much of the running time" is exactly that
// (docs/prototype/constraints.md). Flagged by code, reported, never scored (OV-251).
const NUMBER_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|twenty|thirty|forty|fifty|hundred";
const CLAIMS: RegExp[] = [
  /\b\d+(?:[.,]\d+)?(?:%|\s*(?:percent|per cent|minutes?|mins?|seconds?|hours?|steps?|instructions?|points?|tips?|rules?|things?|parts?)\b)?/gi,
  new RegExp(`\\b(?:${NUMBER_WORDS})\\b(?:\\s+\\w+){0,2}`, "gi"),
  /\b(?:most|much|half|all|majority|bulk|rest)\s+of\s+(?:the\s+)?(?:\w+\s+){0,2}(?:running time|runtime|video|time|episode|talk|minutes)\b/gi,
  /\b(?:most|much)\s+of\s+it\b/gi,
];

export function reasonClaims(reason: string): string[] {
  const found = CLAIMS.flatMap((pattern) => [...reason.matchAll(pattern)].map((match) => match[0].trim()));
  return [...new Set(found)].filter((claim) => claim !== "");
}
