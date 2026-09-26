import type { SchemaVersions } from "./SchemaVersions.js";

export interface ClientSchemaVersions {
  clientVersion: number;
  schemaVersions: SchemaVersions;
}

// Release metadata, kept beside the registries it describes rather than in a database
// that would need populating at deploy time. One row per client version that moved a
// registry; clientSchemaVersions.test.ts fails if a registry moves without one
// (docs/architecture/api.md).
export const CLIENT_SCHEMA_VERSIONS: readonly ClientSchemaVersions[] = [
  { clientVersion: 1, schemaVersions: { overview: 4, overviewState: 1, topic: 1, settings: 1 } },
];

export function schemaVersionsForClient(clientVersion: number): SchemaVersions {
  let matched = CLIENT_SCHEMA_VERSIONS[0]!;
  for (const row of CLIENT_SCHEMA_VERSIONS) {
    if (row.clientVersion <= clientVersion) {
      matched = row;
    }
  }
  return matched.schemaVersions;
}
