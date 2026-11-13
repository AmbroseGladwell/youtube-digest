import { describe, expect, it } from "vitest";
import { ProjectId } from "@overview/domain";
import { makeOverview, makeOverviewState } from "../../overviews/types/OverviewFactory.testHelper.js";
import { makeProject, makeProjectMember } from "../types/ProjectFactory.testHelper.js";
import { activeSummaries, archivedSummaries, projectSummaries, projectsHolding } from "./projectSummaries.js";

const held = (overrides: Parameters<typeof makeOverview>[0] = {}, read = false) => {
  const overview = makeOverview(overrides);
  return { overview, state: makeOverviewState(overview.id, { read }) };
};

describe("projectSummaries", () => {
  it("counts only overviews this library holds, and dates a project by the latest thing put in it", () => {
    const kitchen = makeProject();
    const read = held({}, true);
    const unread = held();
    const gone = makeOverview();
    const members = [
      makeProjectMember(kitchen, read.overview.id, { addedAt: "2026-11-05T09:00:00.000Z" }),
      makeProjectMember(kitchen, unread.overview.id, { addedAt: "2026-11-07T09:00:00.000Z" }),
      makeProjectMember(kitchen, gone.id, { addedAt: "2026-11-12T09:00:00.000Z" }),
    ];

    const [summary] = projectSummaries([kitchen], members, [read, unread]);

    expect(summary!.items.map((item) => item.overview.id)).toEqual([read.overview.id, unread.overview.id]);
    expect(summary!.unread).toBe(1);
    expect(summary!.updatedAt).toBe("2026-11-07T09:00:00.000Z");
  });

  it("orders last changed first, keeps archived apart newest archived first, and leaves archived off an overview's line", () => {
    const overview = held();
    const older = makeProject({
      id: ProjectId.parse("11111111-1111-4111-8111-111111111111"),
      name: "Older",
      createdAt: "2026-10-01T00:00:00.000Z",
    });
    const newer = makeProject({
      id: ProjectId.parse("22222222-2222-4222-8222-222222222222"),
      name: "Newer",
      createdAt: "2026-11-01T00:00:00.000Z",
    });
    const shelved = makeProject({
      id: ProjectId.parse("33333333-3333-4333-8333-333333333333"),
      name: "Shelved",
      archivedAt: "2026-11-02T00:00:00.000Z",
    });
    const members = [older, shelved].map((project) =>
      makeProjectMember(project, overview.overview.id, { addedAt: "2026-10-02T00:00:00.000Z" }),
    );

    const summaries = projectSummaries([older, newer, shelved], members, [overview]);

    expect(activeSummaries(summaries).map(({ project }) => project.name)).toEqual(["Newer", "Older"]);
    expect(archivedSummaries(summaries).map(({ project }) => project.name)).toEqual(["Shelved"]);
    expect(projectsHolding(summaries, overview.overview.id).map(({ project }) => project.name)).toEqual(["Older"]);
  });
});
