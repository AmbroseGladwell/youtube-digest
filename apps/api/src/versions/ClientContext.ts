import type { SchemaVersions } from "@overview/domain";

export interface ClientContext {
  version: number;
  schemaVersions: SchemaVersions;
}
