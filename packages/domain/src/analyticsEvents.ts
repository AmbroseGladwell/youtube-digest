import { z } from "zod";
import { MilestoneId } from "./Milestone.js";
import { Plan } from "./Plan.js";

// A property can only be a choice, a flag or a number: nothing that could carry a URL,
// an id or a sentence the reader wrote (docs/architecture/analytics.md, "What an event may carry").
export type AnalyticsProp = z.ZodEnum | z.ZodBoolean | z.ZodNumber;
export type AnalyticsProps = Record<string, AnalyticsProp>;

export interface AnalyticsEventDefinition<P extends AnalyticsProps = AnalyticsProps> {
  description: string;
  props: P;
}

function event(description: string): AnalyticsEventDefinition<{}>;
function event<P extends AnalyticsProps>(description: string, props: P): AnalyticsEventDefinition<P>;
function event(description: string, props: AnalyticsProps = {}): AnalyticsEventDefinition {
  return { description, props };
}

// Every event the app can send, grouped by where in the app it happens. The description is
// the catalogue: it is what someone reading the numbers is told the event means.
export const analyticsEvents = {
  consent: {
    shown: event("An assistant's request to connect is shown on the consent screen"),
    approved: event("The reader approves an assistant's request to connect"),
    declined: event("The reader declines an assistant's request to connect", { plan: Plan }),
    planRequired: event("A reader on Free is told that connecting an assistant needs Plus"),
  },
  connections: {
    revoked: event("The reader revokes an assistant's access in Settings › Connections"),
  },
  timeSaved: {
    opened: event("The reader opens the time-saved breakdown from the library's total"),
    milestoneShown: event("A time-saved milestone card is shown to the reader", { milestone: MilestoneId }),
    milestoneDismissed: event("The reader dismisses a time-saved milestone card", { milestone: MilestoneId }),
  },
  analytics: {
    dropped: event("The app dropped events it could not send or hold, sent with the next batch that got through", {
      count: z.number().int().min(1).max(100_000),
    }),
  },
} as const satisfies Record<string, Record<string, AnalyticsEventDefinition>>;

// Events the server records itself, from things that never pass through the app: an
// assistant reading the library over /mcp. Not in analyticsEventDefinitions, so /api/events
// refuses them from a client (docs/architecture/analytics.md, "Events the server sends").
export const McpToolName = z.enum(["search_overviews", "list_topics", "get_overview", "get_overviews", "get_transcript"]);
export type McpToolName = z.infer<typeof McpToolName>;

export const McpAssistant = z.enum(["claude", "chatgpt", "other"]);
export type McpAssistant = z.infer<typeof McpAssistant>;

export const serverAnalyticsEvents = {
  mcp: {
    toolCalled: event("An assistant connected to the reader's account called one of the library's MCP tools", {
      tool: McpToolName,
      assistant: McpAssistant,
      failed: z.boolean(),
      overviews: z.number().int().min(0).max(1_000),
      durationMs: z.number().int().min(0).max(600_000),
    }),
  },
} as const satisfies Record<string, Record<string, AnalyticsEventDefinition>>;

export type AnalyticsCatalogue = typeof analyticsEvents;

export type AnalyticsEventName = {
  [Area in keyof AnalyticsCatalogue]: `${Area & string}.${keyof AnalyticsCatalogue[Area] & string}`;
}[keyof AnalyticsCatalogue];

export type AnalyticsEventPropsOf<D> =
  D extends AnalyticsEventDefinition<infer P> ? { [Key in keyof P]: z.infer<P[Key]> } : never;

export const analyticsEventDefinitions: ReadonlyMap<string, AnalyticsEventDefinition> = new Map(
  Object.entries(analyticsEvents).flatMap(([area, events]) =>
    Object.entries(events as Record<string, AnalyticsEventDefinition>).map(
      ([name, definition]) => [`${area}.${name}`, definition] as const,
    ),
  ),
);

export const isAnalyticsEventName = (name: string): name is AnalyticsEventName =>
  analyticsEventDefinitions.has(name);
