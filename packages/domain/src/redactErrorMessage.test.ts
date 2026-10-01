import test from "node:test";
import assert from "node:assert/strict";
import { MAX_ERROR_MESSAGE_LENGTH, redactErrorMessage } from "./redactErrorMessage.js";

test("a URL, with whatever video or page it names, becomes what kind of thing it was", () => {
  assert.equal(
    redactErrorMessage("Failed to fetch https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42 from the panel"),
    "Failed to fetch <url> from the panel",
  );
  assert.equal(redactErrorMessage("Refused to load www.example.test/a/b"), "Refused to load <url>");
  assert.equal(redactErrorMessage("chrome-extension://abcdefghijklmnop/sidepanel.html failed"), "<url> failed");
});

test("an email address is removed", () => {
  assert.equal(redactErrorMessage("No account for reader@example.com"), "No account for <email>");
});

test("quoted text, which is where a title or a note's words turn up, is removed", () => {
  assert.equal(
    redactErrorMessage(`Unexpected token in "How I learned to stop worrying" at position 4`),
    "Unexpected token in <text> at position 4",
  );
  assert.equal(redactErrorMessage("Topic ‘Cooking for one’ not found"), "Topic <text> not found");
  assert.equal(redactErrorMessage("Value `my private note` is invalid"), "Value <text> is invalid");
});

test("a quoted property name is kept, because it says which code failed and nothing about the reader", () => {
  assert.equal(
    redactErrorMessage("Cannot read properties of undefined (reading 'watchAnyway')"),
    "Cannot read properties of undefined (reading 'watchAnyway')",
  );
});

test("ids, a video's included, are removed, and plain words and small numbers are kept", () => {
  assert.equal(redactErrorMessage("No overview for dQw4w9WgXcQ"), "No overview for <id>");
  assert.equal(
    redactErrorMessage("Record 6f1e2d3c-4b5a-4a8e-9b2a-0b8f5f7e3c1d is at version 3"),
    "Record <id> is at version 3",
  );
  assert.equal(redactErrorMessage("Order 12345678 failed"), "Order <id> failed");
  assert.equal(redactErrorMessage("The sync server answered 503 without a readable body"), "The sync server answered 503 without a readable body");
});

test("a long message is cut short, and whitespace is folded", () => {
  const redacted = redactErrorMessage(`too\n\n  long ${"word ".repeat(100)}`);
  assert.equal(redacted.length, MAX_ERROR_MESSAGE_LENGTH);
  assert.ok(redacted.startsWith("too long word"));
  assert.ok(redacted.endsWith("…"));
});

test("redacting twice changes nothing, so the server can redact what the client already did", () => {
  const once = redactErrorMessage(`Failed "Some title" at https://x.test/a for a@b.co with dQw4w9WgXcQ`);
  assert.equal(redactErrorMessage(once), once);
});
