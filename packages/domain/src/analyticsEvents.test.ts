import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  analyticsEventDefinitions,
  analyticsEvents,
  isAnalyticsEventName,
  serverAnalyticsEvents,
} from "./analyticsEvents.js";

test("every event is named area.event in camelCase and says what it means", () => {
  for (const [name, definition] of analyticsEventDefinitions) {
    assert.match(name, /^[a-z][A-Za-z]*\.[a-z][A-Za-z]*$/, name);
    assert.ok(definition.description.length > 20, `${name} needs a description a reader of the numbers can use`);
  }
});

test("every property is a choice, a flag or a number, so none can carry text, a URL or an id", () => {
  for (const [name, definition] of analyticsEventDefinitions) {
    for (const [prop, schema] of Object.entries(definition.props)) {
      assert.ok(
        schema instanceof z.ZodEnum || schema instanceof z.ZodBoolean || schema instanceof z.ZodNumber,
        `${name}.${prop} must be an enum, a boolean or a number`,
      );
    }
  }
});

test("the flat names are exactly the catalogue's", () => {
  const nested = Object.entries(analyticsEvents).flatMap(([area, events]) =>
    Object.keys(events).map((event) => `${area}.${event}`),
  );
  assert.deepEqual([...analyticsEventDefinitions.keys()], nested);
  assert.ok(isAnalyticsEventName("consent.approved"));
  assert.ok(!isAnalyticsEventName("consent"));
  assert.ok(!isAnalyticsEventName("consent.approved.extra"));
});

test("the server's own events follow the same rules, and are not ones a client can send", () => {
  for (const [area, events] of Object.entries(serverAnalyticsEvents)) {
    for (const [name, definition] of Object.entries(events)) {
      assert.ok(!isAnalyticsEventName(`${area}.${name}`), `${area}.${name} must not be accepted from a client`);
      for (const [prop, schema] of Object.entries(definition.props)) {
        assert.ok(
          schema instanceof z.ZodEnum || schema instanceof z.ZodBoolean || schema instanceof z.ZodNumber,
          `${area}.${name}.${prop} must be an enum, a boolean or a number`,
        );
      }
    }
  }
});
