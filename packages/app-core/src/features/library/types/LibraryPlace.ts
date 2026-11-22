import type { ProjectId } from "@overview/domain";

export type LibraryPlace = { kind: "library" } | { kind: "project"; projectId: ProjectId } | { kind: "projects" };

export const WHOLE_LIBRARY: LibraryPlace = { kind: "library" };
