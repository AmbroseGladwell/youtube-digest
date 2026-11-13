import { z } from "zod";
import { OverviewId, ProjectId } from "./Brands.js";
import { ProjectAuthor } from "./ProjectAuthor.js";

// A membership record: one overview in one project. Never a list on either, so two writes
// to different membership records always both land. Removal is dated rather than deleted,
// so an add and a remove of the same overview in the same project settle the same way whichever arrives first (docs/features/projects.md).
export const ProjectMember = z.object({
  id: z.string().min(1),
  projectId: ProjectId,
  overviewId: OverviewId,
  addedAt: z.iso.datetime(),
  addedBy: ProjectAuthor,
  removedAt: z.iso.datetime().nullable(),
});
export type ProjectMember = z.infer<typeof ProjectMember>;

export const ProjectMemberChange = z.union([
  z.object({ addedAt: z.iso.datetime(), addedBy: ProjectAuthor }).strict(),
  z.object({ removedAt: z.iso.datetime() }).strict(),
]);
export type ProjectMemberChange = z.infer<typeof ProjectMemberChange>;

export const projectMemberId = (projectId: string, overviewId: string): string => `${projectId}:${overviewId}`;

const timeOf = (value: unknown): number => (typeof value === "string" ? Date.parse(value) : Number.NaN);

const laterOf = (left: unknown, right: unknown): boolean => {
  const [l, r] = [timeOf(left), timeOf(right)];
  return Number.isNaN(r) ? false : Number.isNaN(l) || r > l;
};

export function isInProject(member: Pick<ProjectMember, "addedAt" | "removedAt">): boolean {
  return member.removedAt === null || timeOf(member.addedAt) > timeOf(member.removedAt);
}

// A change to a membership record is always later than the last one this device knows of, so the
// reader's latest act wins even within a millisecond or against a clock that runs ahead.
export function memberChangeTime(base: Record<string, unknown> | undefined, now: Date): string {
  const known = [base?.addedAt, base?.removedAt].map(timeOf).filter((time) => !Number.isNaN(time));
  return new Date(Math.max(now.getTime(), ...known.map((time) => time + 1))).toISOString();
}

// One function, run by the local store, the server and the rebase. It keeps the latest add
// with whoever made it and the latest removal, so it commutes (docs/features/projects.md).
export function mergeProjectMember(base: Record<string, unknown>, change: Record<string, unknown>): Record<string, unknown> {
  const added = laterOf(base.addedAt, change.addedAt) ? { addedAt: change.addedAt, addedBy: change.addedBy } : {};
  const removed = laterOf(base.removedAt, change.removedAt) ? { removedAt: change.removedAt } : {};
  return { removedAt: null, ...base, ...added, ...removed };
}
