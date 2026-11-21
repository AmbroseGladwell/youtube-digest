import type { Overview, Project, ProjectMember, Topic } from "@overview/domain";

export interface AskStarterLibrary {
  overviews: readonly { overview: Overview; read: boolean }[];
  projects: readonly Project[];
  members: readonly ProjectMember[];
  topics: readonly Topic[];
}

const STARTERS = 3;

const LIBRARY_FALLBACKS = [
  "What are the big themes across everything I've saved?",
  "Which ideas come up again and again in my overviews?",
  "What have I saved that I could act on this week?",
];

const PROJECT_FALLBACKS = [
  "What are the key ideas in this project?",
  "What should I take from this project, in a few steps?",
  "What's missing from this project?",
];

const membersOf = (project: Project, members: readonly ProjectMember[]) =>
  new Set(
    members.filter((member) => member.projectId === project.id && member.removedAt === null).map((member) => member.overviewId as string),
  );

const firstThree = (made: readonly (string | null)[], fallbacks: readonly string[]) =>
  [...made.filter((question): question is string => question !== null), ...fallbacks].slice(0, STARTERS);

// OV-354, page 3: three starter questions under the Ask page's field, made by code from templates
// and the reader's own library (its projects, topics and what's unread), never by a model.
export function askStarters(library: AskStarterLibrary, project: Project | null): string[] {
  if (project !== null) {
    const held = membersOf(project, library.members);
    const unread = library.overviews.filter((entry) => held.has(entry.overview.id) && !entry.read).length;
    return firstThree(
      [
        project.purpose !== null && project.purpose.trim() !== "" ? "Given what this project is for, what should I do first?" : null,
        held.size >= 2 ? `Where do the overviews in ${project.name} disagree?` : null,
        unread >= 2 ? `What do the ${unread} unread overviews here add?` : null,
      ],
      PROJECT_FALLBACKS,
    );
  }
  const counts = new Map<string, number>();
  for (const { overview } of library.overviews) for (const id of overview.topicIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  const topTopic = [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => library.topics.find((topic) => topic.id === id))
    .find((topic) => topic !== undefined);
  const unread = library.overviews.filter((entry) => !entry.read).length;
  const biggest = library.projects
    .filter((each) => each.archivedAt === null)
    .map((each) => ({ project: each, size: membersOf(each, library.members).size }))
    .filter((each) => each.size >= 3)
    .sort((a, b) => b.size - a.size)[0];
  return firstThree(
    [
      topTopic === undefined ? null : `What do my ${topTopic.name} overviews agree on, and where do they differ?`,
      biggest === undefined ? null : `What are the key ideas in my ${biggest.project.name} project?`,
      unread >= 2 ? `What's worth reading first in my ${unread} unread overviews?` : null,
    ],
    LIBRARY_FALLBACKS,
  );
}
