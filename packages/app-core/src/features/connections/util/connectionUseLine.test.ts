import { describe, expect, it } from "vitest";
import { connectionUseLine } from "./connectionUseLine.js";

const NOW = new Date("2026-09-30T15:00:00Z");
const line = (lastUsedAt: string) =>
  connectionUseLine({ createdAt: "2026-09-12T09:00:00Z", lastUsedAt }, NOW, "UTC");

describe("connectionUseLine", () => {
  it("says when it connected, and that it was used within the hour", () => {
    expect(line("2026-09-30T14:20:00Z")).toBe("Connected 12 September · Used in the last hour");
  });

  it("says today for earlier the same day, never minutes", () => {
    expect(line("2026-09-30T08:00:00Z")).toBe("Connected 12 September · Used today");
  });

  it("names the day for anything before today", () => {
    expect(line("2026-09-14T08:00:00Z")).toBe("Connected 12 September · Last used 14 September");
  });

  it("reads today by the reader's own calendar", () => {
    expect(connectionUseLine({ createdAt: "2026-09-12T09:00:00Z", lastUsedAt: "2026-09-29T23:30:00Z" }, NOW, "Europe/Paris")).toBe(
      "Connected 12 September · Used today",
    );
  });
});
