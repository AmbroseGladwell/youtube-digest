import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { analyticsEventDefinitions, isAnalyticsEventName } from "./analyticsEvents.js";

const everyEvent = [...analyticsEventDefinitions];

test("every event is named feature.screen.action in camelCase and says what it means", () => {
  for (const [name, definition] of everyEvent) {
    assert.match(name, /^[a-z][A-Za-z]*\.[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/, name);
    assert.ok(definition.description.length > 20, `${name} needs a description a reader of the numbers can use`);
  }
});

test("every property is a choice, a flag or a number, so none can carry text, a URL or an id", () => {
  for (const [name, definition] of everyEvent) {
    for (const [prop, schema] of Object.entries(definition.props)) {
      assert.ok(
        schema instanceof z.ZodEnum || schema instanceof z.ZodBoolean || schema instanceof z.ZodNumber,
        `${name}.${prop} must be an enum, a boolean or a number`,
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
