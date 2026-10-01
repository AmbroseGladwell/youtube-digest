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

    analytics.consent.shown();
    analytics.consent.declined({ plan: "plus" });
    analytics.connections.revoked();

    expect(recorded).toEqual([
      ["consent.shown", {}],
      ["consent.declined", { plan: "plus" }],
      ["connections.revoked", {}],
    ]);
  });

  it("won't let a call site name an event or property the catalogue doesn't have", () => {
    const { analytics } = recording();
    const refusedByTypes = () => {
      // @ts-expect-error not in the catalogue
      analytics.consent.opened();
      // @ts-expect-error a property approved doesn't declare
      analytics.consent.approved({ videoId: "dQw4w9WgXcQ" });
      // @ts-expect-error not one of the plans
      analytics.consent.declined({ plan: "https://evil.test/" });
      // @ts-expect-error declined says which plan the reader was on
      analytics.consent.declined();
      // @ts-expect-error the queue's own bookkeeping is not the app's to send
      analytics.analytics.dropped({ count: 1 });
    };
    expect(refusedByTypes).toBeTypeOf("function");
  });
});
