import { overviewMetaParts, type SharedNote } from "@overview/domain";
import { formatPublishedDate } from "../../../util/formatPublishedDate.js";

const SHARED_ON = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

// A date the copy does not carry is dropped rather than guessed (docs/prototype/constraints.md).
export const sharedMetaParts = (note: SharedNote, sharedAt: string): string[] => {
  const parts = overviewMetaParts(note);
  if (note.source.publishedAt !== null) {
    parts.push(`published ${formatPublishedDate(note.source.publishedAt)}`);
  }
  parts.push(`shared ${SHARED_ON.format(new Date(sharedAt))}`);
  return parts;
};
