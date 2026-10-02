import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ANALYTICS_IDS, analyticsEventDefinitions, isAnalyticsEventName } from "./analyticsEvents.js";

const everyEvent = [...analyticsEventDefinitions];

test("every event is named feature.screen.action in camelCase and says what it means", () => {
  for (const [name, definition] of everyEvent) {
    assert.match(name, /^[a-z][A-Za-z]*\.[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/, name);
    assert.ok(definition.description.length > 20, `${name} needs a description a reader of the numbers can use`);
  }
});

test("every property is a choice, a flag, a number or one of our own ids, so none can carry text, a URL or a video id", () => {
  const ids: readonly unknown[] = ANALYTICS_IDS;
  for (const [name, definition] of everyEvent) {
    for (const [prop, schema] of Object.entries(definition.props)) {
      assert.ok(
        schema instanceof z.ZodEnum ||
          schema instanceof z.ZodBoolean ||
          schema instanceof z.ZodNumber ||
          ids.includes(schema),
        `${name}.${prop} must be an enum, a boolean, a number or an id from ANALYTICS_IDS`,
      );
    }
  }
});

test("a name is only ever a whole feature, screen and action", () => {
  assert.ok(isAnalyticsEventName("mcp.consentScreen.approved"));
  assert.ok(!isAnalyticsEventName("mcp.consentScreen"));
  assert.ok(!isAnalyticsEventName("consentScreen.approved"));
  assert.ok(!isAnalyticsEventName("mcp.consentScreen.approved.extra"));
});

test("an overview's own events carry its id on the reader, and leave it to the server on a shared link", () => {
  for (const [name, definition] of everyEvent) {
    if (name.startsWith("reader.")) assert.ok("overviewId" in definition.props, name);
    if (name.startsWith("sharedPage.")) assert.ok(!("overviewId" in definition.props), name);
  }
  assert.ok(isAnalyticsEventName("reader.tabs.switched"));
  assert.ok(isAnalyticsEventName("sharedPage.tabs.switched"));
});
