import { z } from "zod";
import { DEFAULT_OVERVIEW_STATE, type OverviewState } from "@overview/domain";
import { isApiError } from "../http/ApiError.js";
import { decideMerge } from "../records/decideMerge.js";
import { logRecordWritten } from "../records/logRecordWritten.js";
import { serverClientContext } from "../versions/serverClientContext.js";
import type { LibraryEntry } from "./Library.js";
import { mcpTool, toolError } from "./McpTool.js";
import { readLibrary } from "./readLibrary.js";

export const OVERVIEWS_PER_MARK = 50;

type Marks = Partial<Pick<OverviewState, "read" | "favourite">>;

const Mark = z
  .object({
    ids: z
      .array(z.string())
      .min(1)
      .max(OVERVIEWS_PER_MARK)
      .describe(`The overviews' ids, as search_overviews gives them. At most ${OVERVIEWS_PER_MARK} a call`),
    read: z.boolean().optional().describe("true to mark them read, false to mark them unread"),
    favourite: z.boolean().optional().describe("true to make them favourites, false to take them out of the favourites"),
  })
  .refine((mark) => mark.read !== undefined || mark.favourite !== undefined, { message: "Give read, favourite or both" });

const marksOf = ({ read, favourite }: { read?: boolean | undefined; favourite?: boolean | undefined }): Marks => ({
  ...(read === undefined ? {} : { read }),
  ...(favourite === undefined ? {} : { favourite }),
});

function describeMarks(marks: Marks): string {
  const words = [
    ...(marks.read === undefined ? [] : [marks.read ? "read" : "unread"]),
    ...(marks.favourite === undefined ? [] : [marks.favourite ? "a favourite" : "not a favourite"]),
  ];
  return words.join(" and ");
}

const alreadyMarked = (entry: LibraryEntry, marks: Marks): boolean => {
  const state = entry.state ?? { ...DEFAULT_OVERVIEW_STATE, overviewId: entry.overview.id };
  return (marks.read === undefined || state.read === marks.read) && (marks.favourite === undefined || state.favourite === marks.favourite);
};

const titled = (entries: LibraryEntry[]) => entries.map((entry) => `- **${entry.overview.video.title}**`);

// The reader's own marks on an overview, written as the state record every device syncs,
// stamped by the server's clock: an assistant is never asked for the time
// (docs/features/mcp-connector.md, "Marking overviews"; CLAUDE.md).
export const markOverviews = mcpTool({
  name: "mark_overviews",
  title: "Mark overviews read or favourite",
  description:
    "Mark saved overviews read or unread, and favourite or not, by id, when the reader asks. Changes only the reader's own marks on an overview, never the overview itself, and reaches every device the reader has.",
  input: Mark,
  writes: true,
  run: async (mark, { sql, accountId, records, clock, log }) => {
    const marks = marksOf(mark);
    const library = await readLibrary(sql, accountId);
    const ids = [...new Set(mark.ids)];
    const chosen = ids.flatMap((id) => library.entries.find((entry) => entry.overview.id === id) ?? []);
    const missing = ids.filter((id) => !chosen.some((entry) => entry.overview.id === id));
    const missingNote = missing.length === 0 ? [] : [`Not in this library: ${missing.join(", ")}.`];
    if (chosen.length === 0) {
      return toolError(`${missingNote[0]} search_overviews gives each overview's id.`);
    }
    const already = chosen.filter((entry) => alreadyMarked(entry, marks));
    const changing = chosen.filter((entry) => !alreadyMarked(entry, marks));
    const updatedAt = clock().toISOString();

    try {
      const written = await records.write(
        accountId,
        changing.map(({ overview }) => ({
          kind: "overviewState" as const,
          id: overview.id,
          decide: (current) =>
            decideMerge(
              "overviewState",
              current,
              {
                patch: { ...marks, overviewId: overview.id },
                updatedAt,
                ifMatch: null,
                defaults: { ...DEFAULT_OVERVIEW_STATE, overviewId: overview.id },
              },
              serverClientContext,
            ),
        })),
      );
      for (const outcome of written) {
        if (outcome !== null) {
          logRecordWritten(log, outcome);
        }
      }
    } catch (error) {
      if (isApiError(error) && error.code === "record_newer_than_client") {
        return toolError("One of these overviews was marked by a newer version of the app than this server knows, so nothing was changed. Try again once the server has updated.");
      }
      throw error;
    }

    const described = describeMarks(marks);
    const lines = [
      ...(changing.length === 0 ? [] : [`Marked ${changing.length} overview(s) ${described}:`, ...titled(changing)]),
      ...(already.length === 0 ? [] : [`Already ${described}, left as they were:`, ...titled(already)]),
      ...missingNote,
    ];
    return { text: lines.join("\n"), overviews: changing.length };
  },
});
