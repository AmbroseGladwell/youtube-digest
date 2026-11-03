import { sourceName } from "./sourceFacts.js";
import type { Source } from "./Source.js";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const monthAndYear = (iso: string) => {
  const date = new Date(iso);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

export function spokenOpening(source: Source): string | null {
  const title = source.title.trim();
  const from = sourceName(source).trim();
  const parts = [
    title === "" ? null : title,
    from === "" ? null : `from ${from}`,
    source.kind === "web" && source.author !== null ? `by ${source.author}` : null,
    source.publishedAt === null ? null : `published in ${monthAndYear(source.publishedAt)}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : `${parts.join(", ")}.`;
}
