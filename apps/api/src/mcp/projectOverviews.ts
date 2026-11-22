import { isInProject, type ProjectOverview } from "@overview/domain";
import type { Library, LibraryEntry } from "./Library.js";

export interface ProjectEntry extends ProjectOverview {
  entry: LibraryEntry;
}

export const projectOverviews = (library: Library, projectId: string): ProjectEntry[] => {
  const entries = new Map(library.entries.map((entry) => [entry.overview.id, entry]));
  return library.members
    .filter((member) => member.projectId === projectId && isInProject(member))
    .flatMap((member) => {
      const entry = entries.get(member.overviewId);
      return entry === undefined ? [] : [{ entry, overview: entry.overview, read: entry.state?.read ?? false, addedBy: member.addedBy }];
    });
};
