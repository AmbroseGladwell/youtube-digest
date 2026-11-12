import type { Provider } from "@overview/domain";
import type { ArticleFailure } from "../api/ArticleReadError.js";

// What a failed run tells the reader. A model they chose gets our own words and a way to
// change it, never the provider's response (OV-247). An article our server couldn't fetch
// gets the same words a pasted link does (OV-285).
export type RunError =
  | { kind: "message"; message: string }
  | { kind: "chosenModel"; provider: Provider; model: string }
  | { kind: "articleFetch"; failure: ArticleFailure; url: string; regenerating: boolean };
