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

// Every event is something the reader did in the app: a click, a choice, a thing they made.
// What the app or the server did on its own is logged, never an event
// (docs/architecture/analytics.md, "Actions, not logs"). Each is named feature.screen.action
// so a name says where it happened without a lookup ("Naming"), and its description is
// what someone reading the numbers is told it means.
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
} as const satisfies AnalyticsCatalogueShape;

export type AnalyticsCatalogue = typeof analyticsEvents;

export type AnalyticsEventName = {
  [Feature in keyof AnalyticsCatalogue]: {
    [Screen in keyof AnalyticsCatalogue[Feature]]: `${Feature & string}.${Screen & string}.${keyof AnalyticsCatalogue[Feature][Screen] & string}`;
  }[keyof AnalyticsCatalogue[Feature]];
}[keyof AnalyticsCatalogue];

export type AnalyticsEventPropsOf<D> =
  D extends AnalyticsEventDefinition<infer P> ? { [Key in keyof P]: z.infer<P[Key]> } : never;

const flattenCatalogue = (catalogue: AnalyticsCatalogueShape): Map<string, AnalyticsEventDefinition> =>
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
