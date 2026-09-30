import { overviewMetaParts, type SharedNote } from "@overview/domain";
import { formatPublishedDate } from "../../../util/formatPublishedDate.js";

const SHARED_ON = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

// Design 30e: the reader's own three numbers, then when the video went up and when this
// copy was made. A term whose date the copy does not carry is dropped rather than guessed
// (docs/prototype/constraints.md).
export function sharedMetaParts(note: SharedNote, sharedAt: string): string[] {
  const parts = overviewMetaParts(note);
  if (note.video.publishedAt !== null) {
    parts.push(`published ${formatPublishedDate(note.video.publishedAt)}`);
  }
  parts.push(`shared ${SHARED_ON.format(new Date(sharedAt))}`);
  return parts;
}
