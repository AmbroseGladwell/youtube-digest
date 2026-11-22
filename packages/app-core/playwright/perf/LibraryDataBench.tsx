import { useEffect, useState } from "react";
import { CURRENT_SCHEMA_VERSIONS, type OverviewStore, type RecordChange } from "@overview/domain";
import { deleteLocalLibrary, openLocalLibrary } from "@overview/store-local";
import { makeOverview, makeOverviewState } from "../../src/features/overviews/types/OverviewFactory.testHelper.js";
import { readLibraryEntries } from "../../src/features/overviews/queries/overviewsWithStateQuery.js";

const PULL_PAGE = 200;
const REPEATS = 5;

export interface LibraryDataBenchResult {
  size: number;
  firstSyncWriteMs: number;
  stateEachReadMs: number[];
  libraryReadMs: number[];
}

declare global {
  interface Window {
    __benchResult?: LibraryDataBenchResult | { error: string };
  }
}

const changesFor = (size: number): RecordChange[] => {
  const changes: RecordChange[] = [];
  const updatedAt = new Date().toISOString();
  for (let index = 0; index < size; index += 1) {
    const overview = makeOverview({ savedAt: new Date(Date.UTC(2025, 0, 1) + index * 3_600_000).toISOString() });
    overview.source.title = `Overview ${index}`;
    const common = { rev: 1, seq: changes.length + 1, updatedAt, deleted: false };
    changes.push({ kind: "overview", id: overview.id, schemaVersion: CURRENT_SCHEMA_VERSIONS.overview, ...common, body: overview });
    if (index % 2 === 0) {
      changes.push({
        kind: "overviewState",
        id: overview.id,
        schemaVersion: CURRENT_SCHEMA_VERSIONS.overviewState,
        ...common,
        seq: changes.length + 1,
        body: makeOverviewState(overview.id, { read: true }),
      });
    }
  }
  return changes;
};

const readWithStateEach = async (overviewStore: OverviewStore) => {
  const [overviews] = await Promise.all([overviewStore.listOverviews(), overviewStore.listUnreadable()]);
  return Promise.all(overviews.map((overview) => overviewStore.getOverviewState(overview.id)));
};

const timed = async (work: () => Promise<unknown>): Promise<number> => {
  const started = performance.now();
  await work();
  return Math.round(performance.now() - started);
};

const run = async (size: number): Promise<LibraryDataBenchResult> => {
  const accountId = `perf-library-${size}`;
  await deleteLocalLibrary({ accountId });
  const library = await openLocalLibrary({ accountId });
  try {
    await library.syncStorage.enrol();
    const changes = changesFor(size);
    const firstSyncWriteMs = await timed(async () => {
      for (let from = 0; from < changes.length; from += PULL_PAGE) {
        await library.syncStorage.applyChanges(changes.slice(from, from + PULL_PAGE), from + PULL_PAGE);
      }
    });
    const stateEachReadMs: number[] = [];
    const libraryReadMs: number[] = [];
    for (let repeat = 0; repeat < REPEATS; repeat += 1) {
      stateEachReadMs.push(await timed(() => readWithStateEach(library.overviewStore)));
      libraryReadMs.push(await timed(() => readLibraryEntries(library.overviewStore)));
    }
    return { size, firstSyncWriteMs, stateEachReadMs, libraryReadMs };
  } finally {
    library.close();
    await deleteLocalLibrary({ accountId });
  }
};

export const LibraryDataBench = ({ size }: { size: number }) => {
  const [done, setDone] = useState(false);
  useEffect(() => {
    void run(size).then(
      (result) => {
        window.__benchResult = result;
        setDone(true);
      },
      (error: unknown) => {
        window.__benchResult = { error: String(error) };
        setDone(true);
      },
    );
  }, [size]);
  return <p data-testid="LibraryDataBench.status">{done ? "done" : "running"}</p>;
};
