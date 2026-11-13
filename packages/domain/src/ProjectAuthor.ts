import { z } from "zod";

// Who made a project or put an overview in one: the reader, or one of their assistant
// connections, named as it was when it acted (docs/features/projects.md).
export const ProjectAuthor = z.discriminatedUnion("by", [
  z.object({ by: z.literal("reader") }),
  z.object({ by: z.literal("assistant"), connectionId: z.string().min(1), name: z.string().min(1) }),
]);
export type ProjectAuthor = z.infer<typeof ProjectAuthor>;

export const BY_READER: ProjectAuthor = { by: "reader" };
