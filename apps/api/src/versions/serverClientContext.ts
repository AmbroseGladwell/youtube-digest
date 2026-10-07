import { CLIENT_VERSION, CURRENT_SCHEMA_VERSIONS } from "@overview/domain";
import type { ClientContext } from "./ClientContext.js";

// The server writing on a reader's behalf, at the shapes it was built with: what an
// assistant's mark through /mcp is written as (docs/features/mcp-connector.md).
export const serverClientContext: ClientContext = { version: CLIENT_VERSION, schemaVersions: CURRENT_SCHEMA_VERSIONS };
