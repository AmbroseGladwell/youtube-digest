import { z } from "zod";
import { OverviewId, ProjectId } from "./Brands.js";
import { MemberAuthor } from "./ProjectAuthor.js";

// One record per membership, removal dated, so writes settle alike in any order (docs/features/projects.md).
export const ProjectMember = z.object({
  id: z.string().min(1),
  projectId: ProjectId,
  overviewId: OverviewId,
  addedAt: z.iso.datetime(),
  addedBy: MemberAuthor,
  removedAt: z.iso.datetime().nullable(),
});
export type ProjectMember = z.infer<typeof ProjectMember>;

export const ProjectMemberChange = z.union([
  z.object({ addedAt: z.iso.datetime(), addedBy: MemberAuthor }).strict(),
  z.object({ removedAt: z.iso.datetime() }).strict(),
]);
export type ProjectMemberChange = z.infer<typeof ProjectMemberChange>;

export const projectMemberId = (projectId: string, overviewId: string): string => `${projectId}:${overviewId}`;

const timeOf = (value: unknown): number => (typeof value === "string" ? Date.parse(value) : Number.NaN);

const laterOf = (left: unknown, right: unknown): boolean => {
  const [l, r] = [timeOf(left), timeOf(right)];
  return Number.isNaN(r) ? false : Number.isNaN(l) || r > l;
};

export const isInProject = (member: Pick<ProjectMember, "addedAt" | "removedAt">): boolean => {
  return member.removedAt === null || timeOf(member.addedAt) > timeOf(member.removedAt);
};

// Always after the last known change, so the latest act wins even against a clock running ahead.
export const memberChangeTime = (base: Record<string, unknown> | undefined, now: Date): string => {
  const known = [base?.addedAt, base?.removedAt].map(timeOf).filter((time) => !Number.isNaN(time));
  return new Date(Math.max(now.getTime(), ...known.map((time) => time + 1))).toISOString();
};

// Shared by the store, the server and the rebase, and it commutes (docs/features/projects.md).
export const mergeProjectMember = (base: Record<string, unknown>, change: Record<string, unknown>): Record<string, unknown> => {
  const added = laterOf(base.addedAt, change.addedAt) ? { addedAt: change.addedAt, addedBy: change.addedBy } : {};
  const removed = laterOf(base.removedAt, change.removedAt) ? { removedAt: change.removedAt } : {};
  return { removedAt: null, ...base, ...added, ...removed };
};
