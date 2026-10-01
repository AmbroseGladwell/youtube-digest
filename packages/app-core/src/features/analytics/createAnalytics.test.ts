import { describe, expect, it } from "vitest";
import { createAnalytics, type AnalyticsRecorder } from "./createAnalytics.js";

const recording = () => {
  const recorded: Array<[string, unknown]> = [];
  const recorder: AnalyticsRecorder = {
    record: (name, props) => void recorded.push([name, props]),
    flush: async () => {},
  };
  return { recorded, analytics: createAnalytics(recorder) };
};

describe("createAnalytics", () => {
  it("has a method per event, named by where in the app it happens", () => {
    const { recorded, analytics } = recording();

    analytics.mcp.consentScreen.shown();
    analytics.mcp.consentScreen.declined({ plan: "plus" });
    analytics.mcp.settingsConnections.revoked();

    expect(recorded).toEqual([
      ["mcp.consentScreen.shown", {}],
      ["mcp.consentScreen.declined", { plan: "plus" }],
      ["mcp.settingsConnections.revoked", {}],
    ]);
  });

  it("won't let a call site name an event or property the catalogue doesn't have", () => {
    const { analytics } = recording();
    const refusedByTypes = () => {
      // @ts-expect-error not in the catalogue
      analytics.mcp.consentScreen.opened();
      // @ts-expect-error a property approved doesn't declare
      analytics.mcp.consentScreen.approved({ videoId: "dQw4w9WgXcQ" });
      // @ts-expect-error not one of the plans
      analytics.mcp.consentScreen.declined({ plan: "https://evil.test/" });
      // @ts-expect-error declined says which plan the reader was on
      analytics.mcp.consentScreen.declined();
      // @ts-expect-error the queue's own bookkeeping is not the app's to send
      analytics.analytics.queue.dropped({ count: 1 });
    };
    expect(refusedByTypes).toBeTypeOf("function");
  });
});
