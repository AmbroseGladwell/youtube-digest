import { describe, expect, it } from "vitest";
import { CLIENT_NAME_LIMIT, consentHeading } from "./consentHeading.js";

describe("consentHeading", () => {
  it("quotes the name the assistant gave, and says it is unchecked", () => {
    const heading = consentHeading("Claude");
    expect(heading.title).toBe("“Claude” wants to read your overviews");
    expect(heading.label).toBe(heading.title);
    expect(heading.sub).toContain("we can’t check it");
  });

  it.each([null, "", "   "])("drops the name when there is none (%j)", (name) => {
    const heading = consentHeading(name);
    expect(heading.title).toBe("An assistant wants to read your overviews");
    expect(heading.sub).toContain("It didn’t give a name");
  });

  it("shortens a long name on screen but keeps it whole for assistive technology", () => {
    const long = "A".repeat(CLIENT_NAME_LIMIT + 20);
    const heading = consentHeading(long);
    expect(heading.title).toBe(`“${"A".repeat(CLIENT_NAME_LIMIT)}…” wants to read your overviews`);
    expect(heading.label).toBe(`“${long}” wants to read your overviews`);
  });
});
