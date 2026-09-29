import { describe, expect, it } from "vitest";
import { looksLikeEmail } from "./looksLikeEmail.js";

describe("looksLikeEmail", () => {
  it.each(["reader@example.com", " reader@mail.example.co.uk ", "a.b+c@d.io"])("accepts %s", (value) => {
    expect(looksLikeEmail(value)).toBe(true);
  });

  it.each(["", "reader", "reader@example", "reader@.com", "reader@example.", "two words@example.com"])(
    "refuses %j",
    (value) => {
      expect(looksLikeEmail(value)).toBe(false);
    },
  );
});
