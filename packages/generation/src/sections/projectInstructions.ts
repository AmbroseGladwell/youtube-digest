import { z } from "zod";
import type { FilingProject, ProjectId } from "@overview/domain";

const projectLine = ({ name, purpose }: FilingProject): string =>
  purpose === null ? `- "${name}" (only a name)` : `- "${name}": ${purpose}`;

// Left out of the prompt and the schema with no projects, so a reader without any sends what they
// always did, and the schema grows only for those who have some (docs/features/projects.md,
// "Filing as an overview is made").
export const projectInstructions = (projects: readonly FilingProject[], source: "video" | "article"): string => {
  if (projects.length === 0) {
    return "";
  }
  return `

## Projects
Here is what the reader is working on, each with what it's for in their own words:
${projects.map(projectLine).join("\n")}

Say which of them this ${source} clearly serves: one the reader would want in
front of them when they come back to work on that project. Being on a nearby
subject isn't enough; it has to help with what the project is for. A project
with only a name needs the ${source} to be plainly about that name. Most ${source}s
serve none, and an empty match set is a normal, honest outcome. Never name a
project that isn't listed.`;
};

export const projectSchemaShape = (projects: readonly FilingProject[]): z.ZodRawShape => {
  if (projects.length === 0) {
    return {};
  }
  const names = [...new Set(projects.map((project) => project.name))] as [string, ...string[]];
  return { matchedProjectNames: z.array(z.enum(names)) };
};

export const filedProjectIds = (projects: readonly FilingProject[], matched: readonly string[] | undefined): ProjectId[] => {
  const names = new Set(matched ?? []);
  return projects.filter((project) => names.has(project.name)).map((project) => project.id);
};
