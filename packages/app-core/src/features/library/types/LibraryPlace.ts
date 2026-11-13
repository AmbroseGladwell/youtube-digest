import type { ProjectId } from "@overview/domain";

// What the library's main column is showing: every overview, one project's, or the list of
// projects (docs/features/projects.md, "The project page").
export type LibraryPlace = { kind: "library" } | { kind: "project"; projectId: ProjectId } | { kind: "projects" };

export const WHOLE_LIBRARY: LibraryPlace = { kind: "library" };
