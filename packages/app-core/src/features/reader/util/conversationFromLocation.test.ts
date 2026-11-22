import { describe, expect, it } from "vitest";
import { conversationFromLocation } from "./conversationFromLocation.js";

describe("conversationFromLocation", () => {
  it("reads the conversation a link from the Ask drawer carried, and nothing from any other state", () => {
    expect(conversationFromLocation({ conversation: "c1" })).toBe("c1");
    expect(conversationFromLocation(null)).toBeNull();
    expect(conversationFromLocation({ wasJustGenerated: true })).toBeNull();
    expect(conversationFromLocation({ conversation: "" })).toBeNull();
    expect(conversationFromLocation({ conversation: 3 })).toBeNull();
  });
});
