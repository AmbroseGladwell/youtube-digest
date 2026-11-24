import type { Overview, Project, ProjectMember, SavedCapture, Topic } from "@overview/domain";

export const RECENT_OVERVIEWS_SHOWN = 4;
export const PICKER_OPTIONS_SHOWN = 8;

export type PickerOption =
  | { kind: "project"; project: Project; count: number }
  | { kind: "topic"; topic: Topic; count: number }
  | { kind: "overview"; overview: Overview }
  | { kind: "saved"; capture: SavedCapture };

export const pickerTitleOf = (option: PickerOption): string => {
  if (option.kind === "project") {
    return option.project.name;
  }
  if (option.kind === "topic") {
    return option.topic.name;
  }
  return option.kind === "overview" ? option.overview.source.title : option.capture.source.title;
};

export const pickerKeyOf = (option: PickerOption): string => {
  if (option.kind === "project") {
    return option.project.id;
  }
  if (option.kind === "topic") {
    return option.topic.id;
  }
  return option.kind === "overview" ? option.overview.id : option.capture.id;
};

export interface PickerOptions {
  options: PickerOption[];
  more: number;
}

const wordsOf = (query: string) =>
  query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "");

const matches = (text: string, words: readonly string[]) => {
  const lower = text.toLowerCase();
  return words.every((word) => lower.includes(word));
};

export interface SourcePickerQuery {
  query: string;
  projects: readonly Project[];
  members: readonly ProjectMember[];
  topics?: readonly Topic[];
  overviews: readonly Overview[];
  saved: readonly SavedCapture[];
  exclude: ReadonlySet<string>;
}

interface Dated {
  savedAt: string;
  option: PickerOption;
}

export const sourcePickerOptions = ({
  query,
  projects,
  members,
  topics = [],
  overviews,
  saved,
  exclude,
}: SourcePickerQuery): PickerOptions => {
  const words = wordsOf(query);
  const counted = projects
    .filter((project) => project.archivedAt === null && !exclude.has(project.id))
    .map((project): PickerOption => ({
      kind: "project",
      project,
      count: members.filter((member) => member.projectId === project.id && member.removedAt === null).length,
    }));
  const topicCounts = topics
    .filter((topic) => !exclude.has(topic.id))
    .map((topic): PickerOption => ({
      kind: "topic",
      topic,
      count: overviews.filter((overview) => overview.topicIds.some((id) => id === topic.id)).length,
    }))
    .filter((option) => option.kind === "topic" && option.count > 0);
  const newest = [...overviews]
    .filter((overview) => !exclude.has(overview.id))
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  if (words.length === 0) {
    return {
      options: [
        ...counted,
        ...topicCounts,
        ...newest.slice(0, RECENT_OVERVIEWS_SHOWN).map((overview): PickerOption => ({ kind: "overview", overview })),
      ],
      more: 0,
    };
  }
  const found = [
    ...counted.filter((option) => option.kind === "project" && matches(option.project.name, words)),
    ...topicCounts.filter((option) => option.kind === "topic" && matches(option.topic.name, words)),
    ...[
      ...newest.map((overview): Dated => ({ savedAt: overview.savedAt, option: { kind: "overview", overview } })),
      ...saved.map((capture): Dated => ({ savedAt: capture.savedAt, option: { kind: "saved", capture } })),
    ]
      .filter(({ option }) => matches(pickerTitleOf(option), words))
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .map(({ option }) => option),
  ];
  return { options: found.slice(0, PICKER_OPTIONS_SHOWN), more: Math.max(0, found.length - PICKER_OPTIONS_SHOWN) };
};

export interface MarkedText {
  text: string;
  marked: boolean;
}

export const markedPieces = (text: string, query: string): Array<MarkedText> => {
  const words = wordsOf(query);
  if (words.length === 0) {
    return [{ text, marked: false }];
  }
  const lower = text.toLowerCase();
  const marked = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) {
      marked.fill(true, at, at + word.length);
    }
  }
  const pieces: Array<{ text: string; marked: boolean }> = [];
  for (let index = 0; index < text.length; index += 1) {
    const last = pieces.at(-1);
    if (last !== undefined && last.marked === marked[index]) {
      last.text += text[index];
    } else {
      pieces.push({ text: text[index]!, marked: marked[index]! });
    }
  }
  return pieces;
};

export interface AtQuery {
  start: number;
  query: string;
}

export const atQueryOf = (text: string, caret: number): AtQuery | null => {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1 || (at > 0 && !/\s/.test(before[at - 1]!))) {
    return null;
  }
  const query = before.slice(at + 1);
  return /\n/.test(query) || query.length > 60 ? null : { start: at, query };
};
