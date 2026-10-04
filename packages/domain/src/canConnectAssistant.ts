import type { Plan } from "./Plan.js";

// Every account can connect an assistant until billing exists (OV-18), so the connector can
// be tested; it then returns to Plus (docs/features/mcp-connector.md, "Plus").
export function canConnectAssistant(_plan: Plan): boolean {
  return true;
}
