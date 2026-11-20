import { overviewMarkdown, type ChatSource, type Overview, type Project } from "@overview/domain";

export interface SourcesTurn {
  sources: readonly ChatSource[];
  setAside: readonly string[];
}

export interface LabelledSource {
  source: ChatSource;
  overview: Overview;
}

export interface OtherSourcesInPrompt {
  blocks: Array<string | null>;
  labels: ReadonlyMap<string, LabelledSource>;
}

// One user message per question that added overviews or set some aside, rebuilt the same way for
// every later question from what the conversation stored, so the prompt only ever grows at its end
// (docs/architecture/in-app-chat.md, "What it does to a reader's month"). An overview deleted since
// is left out and can no longer be cited.
export function otherSourcesInPrompt(
  turns: readonly SourcesTurn[],
  overviews: ReadonlyMap<string, Overview>,
  projects: ReadonlyMap<string, Project>,
): OtherSourcesInPrompt {
  const labels = new Map<string, LabelledSource>();
  const titles = new Map<string, string>();
  let shown = false;
  const blocks = turns.map(({ sources, setAside }) => {
    const present = sources.flatMap((source) => {
      titles.set(source.label, source.title);
      const overview = overviews.get(source.overviewId);
      return overview === undefined ? [] : [{ source, overview }];
    });
    for (const entry of present) labels.set(entry.source.label, entry);
    for (const label of setAside) labels.delete(label);
    const parts = [
      present.length === 0 ? null : sourcesBlock(present, projects, !shown),
      setAside.length === 0 ? null : setAsideBlock(setAside.map((label) => `${label} (${titles.get(label) ?? "an overview"})`)),
    ].filter((part) => part !== null);
    if (present.length > 0) shown = true;
    return parts.length === 0 ? null : parts.join("\n\n");
  });
  return { blocks, labels };
}

const listed = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

const FIRST_LEAD = `# Other overviews from the reader's library

The reader saved these too. They are not what this chat is about, but the reader may ask about them or how they apply here. Each is labelled S1, S2 and so on, and its ids carry the label (such as S2.kp3).
- When an answer uses one, name it by its title in the answer, and list its ids in overviewParts. There are no transcripts for these: cite their items only.
- When two of them disagree, or one disagrees with this source, say so plainly rather than blending them.
- When none of them answers a question about the reader's other saved overviews, say none of the overviews you were shown cover it, and cite none of them. Never say the reader's library has nothing on it: you are only shown a few.
- inSource is still about this chat's own transcript alone.`;

const LATER_LEAD = `# More overviews from the reader's library

Added for this question, labelled and cited as before.`;

// OV-307's otherSourcesBlock and pinnedProjectBlock, as measured, with the pins named.
function sourcesBlock(present: readonly LabelledSource[], projects: ReadonlyMap<string, Project>, first: boolean): string {
  const pinned = present
    .filter(({ source }) => source.how === "pinned" && source.projectId === undefined)
    .map(({ source }) => source.label);
  const projectIds = [...new Set(present.flatMap(({ source }) => (source.projectId === undefined ? [] : [source.projectId])))];
  const anyBrief = present.some(({ source }) => source.brief === true);
  const lines = [
    pinned.length === 0 ? null : `The reader pinned ${listed(pinned)} to this conversation with "@".`,
    ...projectIds.map((projectId) => projectLead(projects.get(projectId), present, projectId)),
    anyBrief ? "Cite an overview listed in brief by its label alone (such as S7) in overviewParts." : null,
  ].filter((line) => line !== null);
  const whole = present
    .filter(({ source }) => source.brief !== true)
    .map(
      ({ source, overview }) => `## ${source.label}\n\n${overviewMarkdown(overview, { partIds: true, partIdPrefix: `${source.label}.` })}`,
    );
  const briefs = projectIds.flatMap((projectId) => {
    const brief = present.filter(({ source }) => source.projectId === projectId && source.brief === true);
    if (brief.length === 0) return [];
    return [`# The rest of ${projectName(projects.get(projectId))}, in brief\n\n${brief.map(briefLine).join("\n\n")}`];
  });
  return [first ? FIRST_LEAD : LATER_LEAD, lines.join("\n"), ...whole, ...briefs].filter((part) => part !== "").join("\n\n");
}

const projectName = (project: Project | undefined): string => (project === undefined ? "the project" : `"${project.name}"`);

function projectLead(project: Project | undefined, present: readonly LabelledSource[], projectId: string): string {
  const members = present.filter(({ source }) => source.projectId === projectId);
  const whole = members.filter(({ source }) => source.brief !== true).map(({ source }) => source.label);
  const purpose = project?.purpose === null || project?.purpose === undefined ? "" : `, which they keep for this: "${project.purpose}"`;
  const name = project === undefined ? "one of their projects" : `their project "${project.name}"`;
  const brief = members.length > whole.length;
  return `The reader pinned ${name} to this conversation${purpose}. Its overviews are ${listed(members.map(({ source }) => source.label))}.${
    brief
      ? ` The ${whole.length === 1 ? "one" : "few"} closest to the question (${listed(whole)}) ${whole.length === 1 ? "is" : "are"} given in full; the rest are listed in brief, by title, big picture and core claim.`
      : ""
  }`;
}

const briefLine = ({ source, overview }: LabelledSource): string =>
  [`## [${source.label}] ${overview.source.title}`, overview.bigPicture ?? "", overview.coreClaim].filter((line) => line !== "").join("\n");

const setAsideBlock = (named: readonly string[]): string =>
  `The reader set aside ${listed(named)} from this conversation. Don't use or cite ${named.length === 1 ? "it" : "them"} from here on.`;
