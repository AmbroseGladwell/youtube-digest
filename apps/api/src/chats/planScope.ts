import { z } from "zod";
import { chatSourceKind, sameTopicName, type Overview } from "@overview/domain";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const ChatPlan = z.object({
  filters: z.object({
    read: z.enum(["unread", "read", "any"]),
    favourite: z.enum(["only", "any"]),
    kinds: z.array(z.enum(["video", "article", "recipe", "episode"])),
    topics: z.array(z.string()),
    savedFrom: z.string(),
    savedTo: z.string(),
    novelty: z.array(z.enum(["common_knowledge", "fresh_angle", "original"])),
  }),
  mode: z.enum(["deep", "broad"]),
  picks: z.array(z.string()),
});
export type ChatPlan = z.infer<typeof ChatPlan>;

export interface OverviewMarks {
  read: boolean;
  favourite: boolean;
  topics: readonly string[];
}

export const NO_MARKS: OverviewMarks = { read: false, favourite: false, topics: [] };

export interface PlannedScope {
  kept: string[];
  filtered: boolean;
}

// Code, never the model, keeps the scope: docs/features/chats.md, "Library and project chat".
export const planScope = (
  filters: ChatPlan["filters"],
  labels: ReadonlyMap<string, Overview>,
  marks: ReadonlyMap<string, OverviewMarks>,
): PlannedScope => {
  const known = new Set([...marks.values()].flatMap((each) => each.topics));
  const topics = filters.topics.filter((topic) => [...known].some((name) => sameTopicName(name, topic)));
  const savedFrom = DAY.test(filters.savedFrom) ? filters.savedFrom : "";
  const savedTo = DAY.test(filters.savedTo) ? filters.savedTo : "";
  const filtered =
    filters.read !== "any" ||
    filters.favourite !== "any" ||
    filters.kinds.length > 0 ||
    topics.length > 0 ||
    savedFrom !== "" ||
    savedTo !== "" ||
    filters.novelty.length > 0;
  const kept = [...labels].flatMap(([label, overview]) => {
    const mark = marks.get(overview.id) ?? NO_MARKS;
    const saved = overview.savedAt.slice(0, 10);
    const keep =
      (filters.read === "any" || (filters.read === "unread") === !mark.read) &&
      (filters.favourite === "any" || mark.favourite) &&
      (filters.kinds.length === 0 || filters.kinds.includes(chatSourceKind(overview))) &&
      (topics.length === 0 || topics.some((topic) => mark.topics.some((name) => sameTopicName(name, topic)))) &&
      (savedFrom === "" || saved >= savedFrom) &&
      (savedTo === "" || saved <= savedTo) &&
      (filters.novelty.length === 0 || (overview.verdict !== null && filters.novelty.includes(overview.verdict.novelty)));
    return keep ? [label] : [];
  });
  return { kept, filtered };
};
