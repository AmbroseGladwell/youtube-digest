import type { Overview, Project, ProjectMember } from "@overview/domain";

export const RECENT_OVERVIEWS_SHOWN = 4;
export const PICKER_OPTIONS_SHOWN = 8;

export type PickerOption = { kind: "project"; project: Project; count: number } | { kind: "overview"; overview: Overview };

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

// OV-354, page 1: with nothing typed, the projects with their counts, then the four overviews saved
// most recently; typed words filter by title or project name, titles only, the first eight shown.
// Never the chat's own overview, nor anything already added.
export function sourcePickerOptions({
  query,
  projects,
  members,
  overviews,
  exclude,
}: {
  query: string;
  projects: readonly Project[];
  members: readonly ProjectMember[];
  overviews: readonly Overview[];
  exclude: ReadonlySet<string>;
}): PickerOptions {
  const words = wordsOf(query);
  const counted = projects
    .filter((project) => project.archivedAt === null && !exclude.has(project.id))
    .map((project): PickerOption => ({
      kind: "project",
      project,
      count: members.filter((member) => member.projectId === project.id && member.removedAt === null).length,
    }));
  const newest = [...overviews]
    .filter((overview) => !exclude.has(overview.id))
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  if (words.length === 0) {
    return {
      options: [...counted, ...newest.slice(0, RECENT_OVERVIEWS_SHOWN).map((overview): PickerOption => ({ kind: "overview", overview }))],
      more: 0,
    };
  }
  const found = [
    ...counted.filter((option) => option.kind === "project" && matches(option.project.name, words)),
    ...newest.filter((overview) => matches(overview.source.title, words)).map((overview): PickerOption => ({ kind: "overview", overview })),
  ];
  return { options: found.slice(0, PICKER_OPTIONS_SHOWN), more: Math.max(0, found.length - PICKER_OPTIONS_SHOWN) };
}

// The title in pieces, each typed word marked where it appears, for the picker to set in bold.
export function markedPieces(text: string, query: string): Array<{ text: string; marked: boolean }> {
  const words = wordsOf(query);
  if (words.length === 0) return [{ text, marked: false }];
  const lower = text.toLowerCase();
  const marked = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    for (let at = lower.indexOf(word); at !== -1; at = lower.indexOf(word, at + word.length)) marked.fill(true, at, at + word.length);
  }
  const pieces: Array<{ text: string; marked: boolean }> = [];
  for (let index = 0; index < text.length; index += 1) {
    const last = pieces.at(-1);
    if (last !== undefined && last.marked === marked[index]) last.text += text[index];
    else pieces.push({ text: text[index]!, marked: marked[index]! });
  }
  return pieces;
}

// The "@" being typed at the caret, and what follows it, or null when the caret isn't in one.
export function atQueryOf(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at === -1 || (at > 0 && !/\s/.test(before[at - 1]!))) return null;
  const query = before.slice(at + 1);
  return /\n/.test(query) || query.length > 60 ? null : { start: at, query };
}
