import { CLIENT_VERSION, CURRENT_SCHEMA_VERSIONS } from "@overview/domain";
import type { ClientContext } from "./ClientContext.js";

// What an assistant's mark through /mcp is written as.
export const serverClientContext: ClientContext = { version: CLIENT_VERSION, schemaVersions: CURRENT_SCHEMA_VERSIONS };
