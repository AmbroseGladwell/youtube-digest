export interface TranscriptQuery {
  phrases: string[];
  words: string[];
}

export const TRANSCRIPT_QUERY_MAX_LENGTH = 200;

const QUOTED = /["“”]([^"“”]*)["“”]/g;

const tokensOf = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}'’\s-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^['’-]+|['’-]+$/g, ""))
    .filter((token) => token !== "");

// Matching rules: docs/features/transcript-search.md, "What matches".
export const transcriptQueryOf = (query: string): TranscriptQuery => {
  const phrases: string[] = [];
  const unquoted = query.replace(QUOTED, (_whole, inside: string) => {
    const tokens = tokensOf(inside);
    if (tokens.length > 1) {
      phrases.push(tokens.join(" "));
      return " ";
    }
    return ` ${inside} `;
  });
  const words = [...new Set(tokensOf(unquoted))];
  return { phrases: [...new Set(phrases)], words };
};

export const isEmptyTranscriptQuery = ({ phrases, words }: TranscriptQuery): boolean => phrases.length === 0 && words.length === 0;
