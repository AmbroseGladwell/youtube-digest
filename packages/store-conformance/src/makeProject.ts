import { randomUUID } from "node:crypto";
import { BY_READER, ProjectId, type Project } from "@overview/domain";

export const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: ProjectId.parse(randomUUID()),
  name: "Kitchen renovation",
  purpose: "Choosing a layout and a budget for a small galley kitchen.",
  createdAt: "2026-11-12T09:00:00.000Z",
  createdBy: BY_READER,
  archivedAt: null,
  ...overrides,
});
