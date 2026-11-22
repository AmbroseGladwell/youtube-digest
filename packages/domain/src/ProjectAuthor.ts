import { z } from "zod";

// Named as it was when it acted (docs/features/projects.md).
export const ProjectAuthor = z.discriminatedUnion("by", [
  z.object({ by: z.literal("reader") }),
  z.object({ by: z.literal("assistant"), connectionId: z.string().min(1), name: z.string().min(1) }),
]);
export type ProjectAuthor = z.infer<typeof ProjectAuthor>;

export const BY_READER: ProjectAuthor = { by: "reader" };

// Filing never makes a project: docs/features/projects.md, "Filing as an overview is made".
export const MemberAuthor = z.union([ProjectAuthor, z.object({ by: z.literal("filing") })]);
export type MemberAuthor = z.infer<typeof MemberAuthor>;

export const BY_FILING: MemberAuthor = { by: "filing" };
