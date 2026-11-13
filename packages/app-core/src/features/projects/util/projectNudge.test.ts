import { describe, expect, it } from "vitest";
import { makeProject } from "../types/ProjectFactory.testHelper.js";
import { projectNudged } from "./projectNudge.js";
import type { ProjectSummary } from "./projectSummaries.js";

const NOW = new Date("2026-11-13T10:00:00.000Z");
const summary = (updatedAt: string, archivedAt: string | null = null): ProjectSummary => ({
  project: makeProject({ archivedAt }),
  items: [],
  unread: 0,
  updatedAt,
});

describe("projectNudged", () => {
  it("asks once 60 days have passed with nothing put in, and never about an archived project", () => {
    expect(projectNudged(summary("2026-09-14T10:00:00.000Z"), null, NOW)).toBe(true);
    expect(projectNudged(summary("2026-09-15T10:00:00.000Z"), null, NOW)).toBe(false);
    expect(projectNudged(summary("2026-08-01T10:00:00.000Z", "2026-10-01T00:00:00.000Z"), null, NOW)).toBe(false);
  });

  it("Keep it puts the question off for another 60 days from when it was chosen", () => {
    expect(projectNudged(summary("2026-08-01T10:00:00.000Z"), "2026-10-01T10:00:00.000Z", NOW)).toBe(false);
    expect(projectNudged(summary("2026-08-01T10:00:00.000Z"), "2026-09-01T10:00:00.000Z", NOW)).toBe(true);
  });
});
