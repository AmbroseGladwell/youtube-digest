import { MAX_TAGS } from "./Filing.js";
import { normaliseTag } from "./normaliseTag.js";
import type { TagAliases } from "./TagAliases.js";

export interface TagVocabulary {
  known: ReadonlySet<string>;
  aliases: TagAliases;
}

// The model's tags as the reader's library spells them. A singular or plural is folded only
// onto a tag that already exists, because a blanket rule mangles words like news and
// analytics (docs/features/tag-reuse.md).
export function resolveTags(raw: readonly string[], { known, aliases }: TagVocabulary): string[] {
  const resolved: string[] = [];
  for (const candidate of raw) {
    const normalised = normaliseTag(candidate);
    if (normalised === null) continue;
    const folded = foldOntoExisting(normalised, known, aliases);
    const tag = Object.hasOwn(aliases, folded) ? aliases[folded]! : folded;
    if (tag !== null && !resolved.includes(tag)) resolved.push(tag);
  }
  return resolved.slice(0, MAX_TAGS);
}

function foldOntoExisting(tag: string, known: ReadonlySet<string>, aliases: TagAliases): string {
  const exists = (candidate: string) => known.has(candidate) || Object.hasOwn(aliases, candidate);
  if (exists(tag)) return tag;
  return otherNumberOf(tag).find(exists) ?? tag;
}

function otherNumberOf(tag: string): string[] {
  const forms = [`${tag}s`, `${tag}es`];
  if (tag.endsWith("y")) forms.push(`${tag.slice(0, -1)}ies`);
  if (tag.endsWith("ies")) forms.push(`${tag.slice(0, -3)}y`);
  if (tag.endsWith("es")) forms.push(tag.slice(0, -2));
  if (tag.endsWith("s")) forms.push(tag.slice(0, -1));
  return forms;
}
