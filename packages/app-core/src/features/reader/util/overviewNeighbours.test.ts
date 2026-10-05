import { describe, expect, it } from "vitest";
import { OverviewId } from "@overview/domain";
import {
  makeOverviewWithState,
  makeUnreadableEntry,
} from "../../overviews/types/OverviewFactory.testHelper.js";
import { DEFAULT_LIBRARY_VIEW } from "../../library/types/LibraryView.js";
import { overviewNeighbours } from "./overviewNeighbours.js";

const ordered = [
  makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" }),
  makeOverviewWithState({ savedAt: "2026-09-15T00:00:00.000Z" }),
  makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" }),
];

describe("overviewNeighbours", () => {
  it("reports the position in the list and the entries either side of it", () => {
    expect(overviewNeighbours(ordered, ordered[1]!.overview.id)).toEqual({
      position: 2,
      total: 3,
      previousId: ordered[0]!.overview.id,
      nextId: ordered[2]!.overview.id,
    });
  });

  it("has no previous at the top of the list and no next at the bottom", () => {
    expect(overviewNeighbours(ordered, ordered[0]!.overview.id).previousId).toBeNull();
    expect(overviewNeighbours(ordered, ordered[2]!.overview.id).nextId).toBeNull();
  });

  it("steps onto an unreadable record rather than skipping past it", () => {
    const first = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" });
    const unreadable = makeUnreadableEntry({
      salvaged: { savedAt: "2026-09-15T00:00:00.000Z", video: null },
    });
    const last = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });

    expect(overviewNeighbours([first, unreadable, last], first.overview.id).nextId).toEqual(
      unreadable.kind === "unreadable" ? unreadable.record.id : null,
    );
  });

  it("reports no position for an overview that isn't in the list", () => {
    const missing = OverviewId.parse("99999999-9999-4999-8999-999999999999");

    expect(overviewNeighbours(ordered, missing)).toEqual({
      position: null,
      total: 3,
      previousId: null,
      nextId: null,
    });
  });

  it("walks the view the list was in, filtered and in its order", () => {
    const zebra = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z", video: { ...makeOverviewWithState().overview.video, title: "Zebra" } });
    const read = makeOverviewWithState({ savedAt: "2026-09-15T00:00:00.000Z" }, { read: true });
    const apple = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z", video: { ...makeOverviewWithState().overview.video, title: "Apple" } });
    const view = { ...DEFAULT_LIBRARY_VIEW, sort: "title" as const };

    expect(overviewNeighbours([zebra, read, apple], apple.overview.id, { view, kept: new Set() })).toEqual({
      position: 1,
      total: 2,
      previousId: null,
      nextId: zebra.overview.id,
    });
  });

  it("keeps the overview in hand in the sequence once it stops matching the view", () => {
    const first = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" });
    const justRead = makeOverviewWithState({ savedAt: "2026-09-15T00:00:00.000Z" }, { read: true });
    const last = makeOverviewWithState({ savedAt: "2026-09-14T00:00:00.000Z" });

    expect(overviewNeighbours([first, justRead, last], justRead.overview.id, { view: DEFAULT_LIBRARY_VIEW, kept: new Set() })).toEqual({
      position: 2,
      total: 3,
      previousId: first.overview.id,
      nextId: last.overview.id,
    });
  });

  it("keeps every overview already stepped past in the sequence, so Previous can go back to it", () => {
    const passed = makeOverviewWithState({ savedAt: "2026-09-16T00:00:00.000Z" }, { read: true });
    const here = makeOverviewWithState({ savedAt: "2026-09-15T00:00:00.000Z" });

    expect(
      overviewNeighbours([passed, here], here.overview.id, {
        view: DEFAULT_LIBRARY_VIEW,
        kept: new Set([passed.overview.id]),
      }).previousId,
    ).toBe(passed.overview.id);
  });
});
