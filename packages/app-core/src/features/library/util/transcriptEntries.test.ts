import { describe, expect, it } from "vitest";
import type { TranscriptSearchResponse } from "@overview/domain";
import { makeOverviewWithState, makeUnreadableEntry } from "../../overviews/types/OverviewFactory.testHelper.js";
import { NO_LIBRARY_FILTERS } from "../types/LibraryFilters.js";
import { TRANSCRIPT_ROWS, transcriptEntries } from "./transcriptEntries.js";

const searching = { ...NO_LIBRARY_FILTERS, query: "zatsiorsky" };
const moment = (startMs: number) => ({ startMs, text: "Zatsiorsky wrote it.", marks: [{ start: 0, end: 10 }] });
const matchesFor = (...ids: string[]): TranscriptSearchResponse => ({
  matches: ids.map((overviewId, index) => ({
    overviewId,
    mentions: ids.length - index,
    moments: [moment(index * 60_000), moment(999_000)],
  })),
});

describe("transcriptEntries", () => {
  it("lists the sources that say it most first, as the server ordered them, each with its best moment", () => {
    const first = makeOverviewWithState();
    const second = makeOverviewWithState();
    const result = transcriptEntries([second, first], searching, matchesFor(first.overview.id, second.overview.id), new Set());
    expect(result.map((entry) => [entry.overview.id, entry.moment.startMs])).toEqual([
      [first.overview.id, 0],
      [second.overview.id, 60_000],
    ]);
  });

  it("leaves out an overview a word already matched in its overview", () => {
    const byWord = makeOverviewWithState();
    const said = makeOverviewWithState();
    const result = transcriptEntries(
      [byWord, said],
      searching,
      matchesFor(byWord.overview.id, said.overview.id),
      new Set([byWord.overview.id]),
    );
    expect(result.map((entry) => entry.overview.id)).toEqual([said.overview.id]);
  });

  it("keeps the other filters: a match outside them is not shown", () => {
    const unread = makeOverviewWithState();
    const read = makeOverviewWithState({}, { read: true });
    const result = transcriptEntries(
      [unread, read],
      { ...searching, status: "unread" },
      matchesFor(read.overview.id, unread.overview.id),
      new Set(),
    );
    expect(result.map((entry) => entry.overview.id)).toEqual([unread.overview.id]);
  });

  it(`shows at most ${TRANSCRIPT_ROWS}`, () => {
    const entries = Array.from({ length: TRANSCRIPT_ROWS + 3 }, () => makeOverviewWithState());
    expect(transcriptEntries(entries, searching, matchesFor(...entries.map((entry) => entry.overview.id)), new Set())).toHaveLength(
      TRANSCRIPT_ROWS,
    );
  });

  it("shows nothing without a search or before an answer, and never an unreadable record or an id this device doesn't hold", () => {
    const entry = makeOverviewWithState();
    const unreadable = makeUnreadableEntry();
    const unreadableId = unreadable.kind === "unreadable" ? unreadable.record.id : "";
    expect(transcriptEntries([entry], NO_LIBRARY_FILTERS, matchesFor(entry.overview.id), new Set())).toEqual([]);
    expect(transcriptEntries([entry], searching, undefined, new Set())).toEqual([]);
    expect(transcriptEntries([entry, unreadable], searching, matchesFor(unreadableId, "not-held"), new Set())).toEqual([]);
  });
});
