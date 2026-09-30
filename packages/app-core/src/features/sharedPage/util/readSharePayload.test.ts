import { describe, expect, it } from "vitest";
import { SHARE_PAYLOAD_ELEMENT_ID } from "@overview/domain";
import { readSharePayload } from "./readSharePayload.js";

const withPayload = (text: string | null): Document => {
  const doc = document.implementation.createHTMLDocument();
  if (text !== null) {
    const script = doc.createElement("script");
    script.id = SHARE_PAYLOAD_ELEMENT_ID;
    script.type = "application/json";
    script.textContent = text;
    doc.body.append(script);
  }
  return doc;
};

describe("readSharePayload", () => {
  it("reads the copy the server inlined", () => {
    expect(readSharePayload(withPayload(JSON.stringify({ state: "revoked" })))).toEqual({ state: "revoked" });
  });

  it("treats a document with no copy in it as a link that goes nowhere", () => {
    expect(readSharePayload(withPayload(null))).toEqual({ state: "unknown" });
  });

  it("treats unreadable JSON as a link that goes nowhere rather than crashing the page", () => {
    expect(readSharePayload(withPayload("{ not json"))).toEqual({ state: "unknown" });
  });

  // A copy written by a newer server than this build knows how to read.
  it("treats a shape it does not recognise the same way", () => {
    expect(readSharePayload(withPayload(JSON.stringify({ state: "something-else" })))).toEqual({
      state: "unknown",
    });
  });
});
