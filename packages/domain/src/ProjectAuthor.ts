import { z } from "zod";

// Who made a project or put an overview in one: the reader, or one of their assistant
// connections, named as it was when it acted (docs/features/projects.md).
export const ProjectAuthor = z.discriminatedUnion("by", [
  z.object({ by: z.literal("reader") }),
  z.object({ by: z.literal("assistant"), connectionId: z.string().min(1), name: z.string().min(1) }),
]);
export type ProjectAuthor = z.infer<typeof ProjectAuthor>;

export const BY_READER: ProjectAuthor = { by: "reader" };

// Who put an overview in a project: a project's own authors, or the filing that runs when an
// overview is made, matching it against the reader's projects (docs/features/projects.md,
// "Filing as an overview is made"). Filing never makes a project, so a project has no such author.
export const MemberAuthor = z.union([ProjectAuthor, z.object({ by: z.literal("filing") })]);
export type MemberAuthor = z.infer<typeof MemberAuthor>;

export const BY_FILING: MemberAuthor = { by: "filing" };
