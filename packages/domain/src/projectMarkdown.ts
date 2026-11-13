import { NOVELTY_LABEL } from "./noveltyLabel.js";
import type { Overview } from "./Overview.js";
import type { Project } from "./Project.js";
import type { ProjectAuthor } from "./ProjectAuthor.js";
import { sourceName } from "./sourceFacts.js";
import type { Novelty } from "./Verdict.js";

export interface ProjectOverview {
  overview: Overview;
  read: boolean;
  addedBy: ProjectAuthor;
}

export interface VerdictSpread {
  original: number;
  fresh_angle: number;
  common_knowledge: number;
  unjudged: number;
  dubious: number;
}

export interface ProjectPage {
  from: number;
  count: number;
}

const FRESHEST_FIRST: readonly Novelty[] = ["original", "fresh_angle", "common_knowledge"];

const freshness = ({ verdict }: Overview): number => (verdict === null ? FRESHEST_FIRST.length : FRESHEST_FIRST.indexOf(verdict.novelty));

// Fresher verdicts first, then newest saved, so an assistant reading a page at a time meets
// what is least likely to be known already (docs/features/projects.md, "get_project").
export function projectOrder<T extends { overview: Overview }>(items: readonly T[]): T[] {
  return [...items].sort(
    (left, right) => freshness(left.overview) - freshness(right.overview) || right.overview.savedAt.localeCompare(left.overview.savedAt),
  );
}

export function verdictSpread(overviews: readonly Overview[]): VerdictSpread {
  const spread: VerdictSpread = { original: 0, fresh_angle: 0, common_knowledge: 0, unjudged: 0, dubious: 0 };
  for (const { verdict } of overviews) {
    if (verdict === null) {
      spread.unjudged += 1;
      continue;
    }
    spread[verdict.novelty] += 1;
    if (verdict.dubious) spread.dubious += 1;
  }
  return spread;
}

export function verdictSpreadLine(spread: VerdictSpread): string {
  const levels = [
    ...FRESHEST_FIRST.filter((novelty) => spread[novelty] > 0).map(
      (novelty) => `${spread[novelty]} ${NOVELTY_LABEL[novelty].toLowerCase()}`,
    ),
    ...(spread.unjudged > 0 ? [`${spread.unjudged} without a verdict`] : []),
  ];
  return [levels.join(", "), ...(spread.dubious > 0 ? [`${spread.dubious} dubious`] : [])].filter((part) => part !== "").join(" · ");
}

export const authorName = (author: ProjectAuthor): string => (author.by === "reader" ? "the reader" : author.name);

function overviewLine({ overview, read, addedBy }: ProjectOverview): string {
  const facts = [
    sourceName(overview.source),
    overview.verdict === null ? null : `${NOVELTY_LABEL[overview.verdict.novelty]}${overview.verdict.dubious ? ", dubious" : ""}`,
    read ? null : "unread",
    addedBy.by === "assistant" ? `added by ${addedBy.name}` : null,
    `saved ${overview.savedAt.slice(0, 10)}`,
    `id ${overview.id}`,
  ].filter((fact) => fact !== null);
  return `- **${overview.source.title}** (${facts.join(" · ")})\n  ${overview.inOneLine}`;
}

function stepsOf({ overview }: ProjectOverview): string | null {
  const items = overview.howToApply?.items ?? [];
  if (items.length === 0) return null;
  return [`### ${overview.source.title} (id ${overview.id})`, ...items.map((item) => `- ${item}`)].join("\n");
}

// A project as a brief: its purpose, what is in it counted in code, its overviews freshest
// first, and every How to apply step in one place. The same text an assistant gets from
// get_project and the reader copies, so the two never differ. With a page, the counts still
// cover the whole project and only the listing is cut (docs/features/projects.md).
export function projectMarkdown(project: Project, items: readonly ProjectOverview[], page?: ProjectPage): string {
  const ordered = projectOrder(items);
  const shown = page === undefined ? ordered : ordered.slice(page.from, page.from + page.count);
  const unread = items.filter((item) => !item.read).length;
  const spread = verdictSpreadLine(verdictSpread(items.map((item) => item.overview)));
  const made = [
    `Made by ${authorName(project.createdBy)} on ${project.createdAt.slice(0, 10)}`,
    project.archivedAt === null ? null : `archived ${project.archivedAt.slice(0, 10)}`,
  ].filter((part) => part !== null);

  const sections = [
    `# ${project.name}`,
    project.purpose === null
      ? "No purpose given. Ask the reader what this project is for before advising on it."
      : `Purpose: ${project.purpose}`,
    `${made.join(" · ")}\nProject id: ${project.id}`,
    [`${items.length} overview(s)`, `${unread} unread`, ...(spread === "" ? [] : [spread])].join(" · "),
  ];
  if (shown.length > 0) {
    sections.push(`## Overviews\n\n${shown.map(overviewLine).join("\n")}`);
    const steps = shown.map(stepsOf).filter((block) => block !== null);
    if (steps.length > 0) sections.push(`## How to apply, from each overview\n\n${steps.join("\n\n")}`);
  }
  return `${sections.join("\n\n")}\n`;
}
