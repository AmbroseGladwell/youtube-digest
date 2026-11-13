import { z } from "zod";
import { ProjectId } from "./Brands.js";
import { ProjectAuthor } from "./ProjectAuthor.js";

export const MAX_PROJECT_NAME_LENGTH = 80;
export const MAX_PROJECT_PURPOSE_LENGTH = 280;

export const ProjectName = z.string().trim().min(1).max(MAX_PROJECT_NAME_LENGTH);
export const ProjectPurpose = z.string().trim().min(1).max(MAX_PROJECT_PURPOSE_LENGTH).nullable();

export const Project = z.object({
  id: ProjectId,
  name: ProjectName,
  purpose: ProjectPurpose,
  createdAt: z.iso.datetime(),
  createdBy: ProjectAuthor,
  // Who wrote the purpose as it stands, so the page can say an assistant wrote it until the
  // reader saves their own (docs/features/projects.md, "The project page").
  purposeBy: ProjectAuthor.nullable(),
  archivedAt: z.iso.datetime().nullable(),
});
export type Project = z.infer<typeof Project>;

// Only the reader edits a project once it exists, so a purpose edited carries the reader as
// its author (docs/features/projects.md).
export const ProjectPatch = Project.pick({ name: true, purpose: true, purposeBy: true, archivedAt: true }).partial();
export type ProjectPatch = z.infer<typeof ProjectPatch>;
