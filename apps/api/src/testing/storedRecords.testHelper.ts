import { randomUUID } from "node:crypto";
import { CURRENT_SCHEMA_VERSIONS, OVERVIEW_CORPUS, type Overview, type Topic } from "@overview/domain";
import { makeOverview } from "@overview/store-conformance";

export const UPDATED_AT = "2026-09-26T08:30:00.000Z";

export const storedOverview = (overrides: Partial<Overview> = {}) => ({
  ...makeOverview(overrides),
  schemaVersion: CURRENT_SCHEMA_VERSIONS.overview,
  updatedAt: UPDATED_AT,
});

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
