import { z } from "zod";
import { Plan } from "./Plan.js";

// A property can only be a choice, a flag or a number: nothing that could carry a URL,
// an id or a sentence the reader wrote (docs/architecture/analytics.md, "What an event may carry").
export type AnalyticsProp = z.ZodEnum | z.ZodBoolean | z.ZodNumber;
export type AnalyticsProps = Record<string, AnalyticsProp>;

export interface AnalyticsEventDefinition<P extends AnalyticsProps = AnalyticsProps> {
  description: string;
  props: P;
}

export type AnalyticsCatalogueShape = Record<string, Record<string, Record<string, AnalyticsEventDefinition>>>;

function event(description: string): AnalyticsEventDefinition<{}>;
function event<P extends AnalyticsProps>(description: string, props: P): AnalyticsEventDefinition<P>;
function event(description: string, props: AnalyticsProps = {}): AnalyticsEventDefinition {
  return { description, props };
}

// Every event the app can send, named feature.screen.action: the feature as a reader would
// name it, the screen or region of the app it happens on, and what the reader did there, so
// a name says where it came from without a lookup (docs/architecture/analytics.md, "Naming").
// The description is the catalogue: what someone reading the numbers is told it means.
export const analyticsEvents = {
  mcp: {
    consentScreen: {
      shown: event("An assistant's request to connect over MCP is shown on the consent screen"),
      plusRequired: event("A reader on Free is told on the consent screen that connecting an assistant needs Plus"),
      approved: event("The reader approves an assistant's request to connect"),
      declined: event("The reader declines an assistant's request to connect", { plan: Plan }),
    },
    settingsConnections: {
      revoked: event("The reader revokes an assistant's access in Settings › Connections"),
    },
  },
  analytics: {
    queue: {
      dropped: event("The app dropped events it could not send or hold, sent with the next batch that got through", {
        count: z.number().int().min(1).max(100_000),
      }),
    },
  },
} as const satisfies AnalyticsCatalogueShape;

// Events the server records itself, from things that never pass through the app: an
// assistant reading the library over /mcp. Not in analyticsEventDefinitions, so /api/events
// refuses them from a client (docs/architecture/analytics.md, "Events the server sends").
export const McpToolName = z.enum(["search_overviews", "list_topics", "get_overview", "get_overviews", "get_transcript"]);
export type McpToolName = z.infer<typeof McpToolName>;

export const McpAssistant = z.enum(["claude", "chatgpt", "other"]);
export type McpAssistant = z.infer<typeof McpAssistant>;

export const serverAnalyticsEvents = {
  mcp: {
    tools: {
      called: event("An assistant connected to the reader's account called one of the library's MCP tools", {
        tool: McpToolName,
        assistant: McpAssistant,
        failed: z.boolean(),
        overviews: z.number().int().min(0).max(1_000),
        durationMs: z.number().int().min(0).max(600_000),
      }),
    },
  },
} as const satisfies AnalyticsCatalogueShape;

export type AnalyticsCatalogue = typeof analyticsEvents;

export type AnalyticsEventName = {
  [Feature in keyof AnalyticsCatalogue]: {
    [Screen in keyof AnalyticsCatalogue[Feature]]: `${Feature & string}.${Screen & string}.${keyof AnalyticsCatalogue[Feature][Screen] & string}`;
  }[keyof AnalyticsCatalogue[Feature]];
}[keyof AnalyticsCatalogue];

export type AnalyticsEventPropsOf<D> =
  D extends AnalyticsEventDefinition<infer P> ? { [Key in keyof P]: z.infer<P[Key]> } : never;

export const flattenCatalogue = (catalogue: AnalyticsCatalogueShape): Map<string, AnalyticsEventDefinition> =>
  new Map(
    Object.entries(catalogue).flatMap(([feature, screens]) =>
      Object.entries(screens).flatMap(([screen, events]) =>
        Object.entries(events).map(([action, definition]) => [`${feature}.${screen}.${action}`, definition] as const),
      ),
    ),
  );

export const analyticsEventDefinitions: ReadonlyMap<string, AnalyticsEventDefinition> = flattenCatalogue(analyticsEvents);

export const isAnalyticsEventName = (name: string): name is AnalyticsEventName =>
  analyticsEventDefinitions.has(name);
