import type { ChosenAssistant } from "@overview/domain";

export type CopiedField = "name" | "description" | "address";

// One line of ChatGPT's connector form: what it asks for, what to put there, and whether we hand
// the reader the value (design 301c).
export interface ConnectorField {
  label: string;
  value: string;
  note?: string;
  action: { kind: "copy"; field: CopiedField } | { kind: "download" } | null;
}

export interface ConnectorStep {
  text: string;
  // The step hands over the connector address, with Copy.
  address?: boolean;
  fields?: ConnectorField[];
}

export interface ConnectorSetupSteps {
  // Said plainly before the steps when the assistant's plan or place limits who can connect.
  limit: string | null;
  // In place of numbered steps, for an assistant we can only describe.
  lead: string | null;
  steps: ConnectorStep[];
}

export const CONNECTOR_NAME = "The Overview";
export const CONNECTOR_DESCRIPTION = "Your overviews and their transcripts";
export const CONNECTOR_ICON_PATH = "/connector-icon.png";

// Each assistant's way in, as the owner reported its menus on 14 November 2026 (design 301b–301e).
// They change without notice, so they live here together, beside OV-266's FOLLOW_UP_ASSISTANTS.
// ChatGPT's free plan can add a custom connector (owner, 15 November 2026), so it carries no limit.
export function connectorSteps(assistant: ChosenAssistant, address: string): ConnectorSetupSteps {
  switch (assistant) {
    case "claude":
      return {
        limit: null,
        lead: null,
        steps: [
          { text: "Copy the address.", address: true },
          { text: "In Claude, open Settings › Connectors and add a custom connector. Paste the address." },
          { text: "Sign in to The Overview when Claude asks, and allow it." },
        ],
      };
    case "chatgpt":
      return {
        limit: null,
        lead: null,
        steps: [
          { text: "In ChatGPT, turn on Developer mode, then create a connector." },
          {
            text: "Fill in the form:",
            fields: [
              { label: "Icon", value: "256 px PNG", action: { kind: "download" } },
              { label: "Name", value: CONNECTOR_NAME, action: { kind: "copy", field: "name" } },
              { label: "Description", value: CONNECTOR_DESCRIPTION, action: { kind: "copy", field: "description" } },
              { label: "MCP server URL", value: address, action: { kind: "copy", field: "address" } },
              { label: "Authentication", value: "OAuth", action: null },
            ],
          },
          {
            text: "Open Advanced OAuth settings:",
            fields: [
              {
                label: "Registration method",
                value: "Dynamic Client Registration",
                note: "CIMD and OIDC show as unavailable. That’s expected.",
                action: null,
              },
              { label: "Default scopes", value: "All three", action: null },
              { label: "Base scopes", value: "Leave empty", action: null },
              { label: "Endpoints", value: "Leave as found", action: null },
            ],
          },
          { text: "Tick the notice about custom servers, then Create." },
          { text: "Sign in to The Overview when ChatGPT asks, and allow it." },
        ],
      };
    case "gemini":
      return {
        limit:
          "Gemini’s custom apps are only for Google AI Pro or Ultra, in the US, for over-18s. We haven’t tested it with The Overview yet.",
        lead: null,
        steps: [
          { text: "Copy the address.", address: true },
          { text: "In Gemini, open Settings › Connected apps › Add a custom app. Paste the address." },
          { text: "Sign in to The Overview when Gemini asks, and allow it." },
        ],
      };
    case "other":
      return {
        limit: null,
        lead: "Any assistant that supports remote MCP servers with OAuth and dynamic client registration can connect.",
        steps: [],
      };
  }
}
