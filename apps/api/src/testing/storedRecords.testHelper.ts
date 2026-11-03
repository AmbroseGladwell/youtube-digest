import { randomUUID } from "node:crypto";
import { CURRENT_SCHEMA_VERSIONS, OVERVIEW_CORPUS, VideoId, type Overview, type Topic } from "@overview/domain";
import { makeOverview, type VideoOverview } from "@overview/store-conformance";

export const UPDATED_AT = "2026-09-26T08:30:00.000Z";

// A video of its own per overview unless the test says otherwise: an account holds one
// overview per video (docs/features/one-overview-per-video.md).
export const storedOverview = (overrides: Partial<Overview> = {}) => ({
  ...makeOverview({ source: distinctVideo(), ...overrides }),
  schemaVersion: CURRENT_SCHEMA_VERSIONS.overview,
  updatedAt: UPDATED_AT,
});

export function distinctVideo(): VideoOverview["source"] {
  const id = randomUUID().slice(0, 11);
  return { ...makeOverview().source, id: VideoId.parse(id), url: `https://www.youtube.com/watch?v=${id}` };
}

export const storedTopic = (overrides: Partial<Topic> = {}) => ({
  id: randomUUID(),
  name: "fitness",
  description: null,
  createdAt: UPDATED_AT,
  ...overrides,
  schemaVersion: CURRENT_SCHEMA_VERSIONS.topic,
  updatedAt: UPDATED_AT,
});

// The corpus's version-2 record, which still carries savedNote: the shape migration 3
// renames, and so the shape that proves a merge has to migrate first.
export const rawOverviewAtVersion2 = (id: string): Record<string, unknown> => {
  const { schemaVersion: _version, ...body } = OVERVIEW_CORPUS.get(2) as Record<string, unknown>;
  return { ...body, id };
};

export const LAST_SCHEMA_VERSION_WITH_VIDEO = 9;

// A body as a client from before `source` writes it (docs/features/source-identity.md).
export function withVideo<T extends { source: Overview["source"] }>({ source, ...rest }: T) {
  const { kind: _kind, ...video } = source;
  return { ...rest, video };
}
