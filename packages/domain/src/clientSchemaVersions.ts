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
  { clientVersion: 1, schemaVersions: { overview: 4, overviewState: 1, topic: 1, settings: 1, followedPlaylist: 0 } },
  { clientVersion: 2, schemaVersions: { overview: 5, overviewState: 1, topic: 1, settings: 1, followedPlaylist: 0 } },
  { clientVersion: 3, schemaVersions: { overview: 6, overviewState: 1, topic: 1, settings: 1, followedPlaylist: 0 } },
  { clientVersion: 4, schemaVersions: { overview: 7, overviewState: 1, topic: 1, settings: 1, followedPlaylist: 1 } },
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
