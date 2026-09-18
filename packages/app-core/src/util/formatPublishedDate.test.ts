import { describe, it, expect } from "vitest";
import { formatPublishedDate } from "./formatPublishedDate.js";

describe("formatPublishedDate", () => {
  it("reads as a day, a short month and a year", () => {
    expect(formatPublishedDate("2023-03-12T09:30:00.000Z")).toBe("12 Mar 2023");
  });

  it("keeps the year even for something published this year", () => {
    expect(formatPublishedDate("2026-01-01T00:00:00.000Z")).toBe("1 Jan 2026");
  });
});
