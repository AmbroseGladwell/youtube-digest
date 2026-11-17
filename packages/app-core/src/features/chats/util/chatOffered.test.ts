import { describe, expect, it } from "vitest";
import { chatOffered } from "./chatOffered.js";

const reader = { signedIn: true, sharedUnsaved: false, synced: true };

describe("chatOffered", () => {
  it("offers asking to a signed-in reader, about any kind of source", () => {
    expect(chatOffered(reader)).toBe(true);
  });

  it("hides it signed out, and on someone else's shared overview", () => {
    expect(chatOffered({ ...reader, signedIn: false })).toBe(false);
    expect(chatOffered({ ...reader, sharedUnsaved: true })).toBe(false);
  });

  it("hides it on an overview the server doesn't hold yet, which it can't answer about", () => {
    expect(chatOffered({ ...reader, synced: false })).toBe(false);
  });
});
