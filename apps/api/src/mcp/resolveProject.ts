import { sameTopicName, type Project } from "@overview/domain";
import type { Library } from "./Library.js";
import { toolError, type McpToolOutcome } from "./McpTool.js";

const named = (project: Project) => `"${project.name}" (id ${project.id}${project.archivedAt === null ? "" : ", archived"})`;

// By id, or by name ignoring case and spaces at the ends. A name two projects share is
// refused naming both, as an unknown one is refused pointing at list_projects.
export function resolveProject(library: Library, nameOrId: string): Project | McpToolOutcome {
  const byId = library.projects.find((project) => project.id === nameOrId);
  if (byId !== undefined) return byId;
  const byName = library.projects.filter((project) => sameTopicName(project.name, nameOrId));
  if (byName.length === 1) return byName[0]!;
  if (byName.length > 1) {
    return toolError(`More than one project is called "${nameOrId}": ${byName.map(named).join(", ")}. Pass the id instead.`);
  }
  return toolError(`There is no project called "${nameOrId}" in this library. list_projects names every project.`);
}

export const isProject = (value: Project | McpToolOutcome): value is Project => !("text" in value);
