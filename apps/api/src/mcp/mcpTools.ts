import { z } from "zod";
import {
  NOVELTY_LABEL,
  OverviewId,
  StoredTranscript,
  overviewMarkdown,
  sameTopicName,
  transcriptBlocks,
  transcriptPlainText,
  type Topic,
} from "@overview/domain";
import type { Library, LibraryEntry } from "./Library.js";
import { LibraryFilters } from "./LibraryFilters.js";
import { mcpTool, toolError, type McpTool, type McpToolOutcome } from "./McpTool.js";
import { pageOf, type Page } from "./pageOf.js";
import { readLibrary } from "./readLibrary.js";
import { searchLibrary, type ResolvedFilters } from "./searchLibrary.js";

// Why these sizes: docs/features/mcp-connector.md, "The context budget".
export const LISTING_PAGE_SIZE = 50;
export const OVERVIEWS_PER_CALL = 10;

const Cursor = z
  .string()
  .regex(/^\d+$/)
  .optional()
  .describe("Where to carry on from: the cursor the previous call ended with");

const topicNames = (topics: Topic[], entry: LibraryEntry) =>
  entry.overview.topicIds.flatMap((id) => topics.find((topic) => topic.id === id)?.name ?? []);

function resolveFilters(library: Library, { topic, ...filters }: LibraryFilters): ResolvedFilters | McpToolOutcome {
  if (topic === undefined) {
    return filters;
  }
  const found = library.topics.find((candidate) => candidate.id === topic || sameTopicName(candidate.name, topic));
  if (found === undefined) {
    return toolError(`There is no topic called "${topic}" in this library. list_topics names every topic.`);
  }
  return { ...filters, topicId: found.id };
}

const isOutcome = (value: ResolvedFilters | McpToolOutcome): value is McpToolOutcome => "text" in value;

function listingLine(library: Library, entry: LibraryEntry): string {
  const { overview } = entry;
  const facts = [
    overview.video.channel,
    overview.verdict === null ? null : `${NOVELTY_LABEL[overview.verdict.novelty]}${overview.verdict.dubious ? ", dubious" : ""}`,
    `topics: ${topicNames(library.topics, entry).join(", ") || "none"}`,
    `saved ${overview.savedAt.slice(0, 10)}`,
    `id ${overview.id}`,
  ].filter((fact) => fact !== null);
  return `- **${overview.video.title}** (${facts.join(" · ")})\n  ${overview.inOneLine}`;
}

function overviewText(library: Library, entry: LibraryEntry): string {
  const topics = topicNames(library.topics, entry);
  return `Overview id: ${entry.overview.id}\nTopics: ${topics.join(", ") || "none"}\n\n${overviewMarkdown(entry.overview)}`;
}

function pageFooter(page: Page<unknown>, noun: string): string[] {
  const lines = [];
  if (page.items.length > 0 && page.total > page.items.length) {
    lines.push(`These are ${noun} ${page.first + 1}–${page.first + page.items.length} of ${page.total}.`);
  }
  if (page.next !== null) {
    lines.push(`More remain: call again with cursor "${page.next}" for the next ${noun}.`);
  }
  return lines;
}

// Degrade visibly: a record this server cannot read is left out, and the assistant is
// told so rather than handed a library that silently looks smaller.
const unreadableNote = (library: Library): string[] =>
  library.unreadable === 0
    ? []
    : [`${library.unreadable} saved overview(s) could not be read by this server and are left out.`];

const searchOverviews = mcpTool({
  name: "search_overviews",
  title: "Search overviews",
  description:
    "Search the reader's saved video overviews, newest saved first. Returns a light listing (title, channel, verdict, topics, saved date, id and the one-line premise) to choose from; read the full notes with get_overview or get_overviews. With no filters it lists the whole library.",
  input: LibraryFilters.extend({ cursor: Cursor }),
  run: async ({ cursor, ...filters }, { sql, accountId }) => {
    const library = await readLibrary(sql, accountId);
    const resolved = resolveFilters(library, filters);
    if (isOutcome(resolved)) {
      return resolved;
    }
    const page = pageOf(searchLibrary(library.entries, resolved), cursor, LISTING_PAGE_SIZE);
    const lines =
      page.total === 0
        ? ["No saved overviews match."]
        : [`${page.total} saved overview(s) match.`, "", ...page.items.map((entry) => listingLine(library, entry))];
    return {
      text: [...lines, "", ...pageFooter(page, "results"), ...unreadableNote(library)].join("\n").trim(),
      overviews: page.items.length,
    };
  },
});

const listTopics = mcpTool({
  name: "list_topics",
  title: "List topics",
  description:
    "List the topics the reader files their overviews under, with how many overviews each holds. A topic's name or id can be passed to search_overviews and get_overviews.",
  input: z.object({}),
  run: async (_input, { sql, accountId }) => {
    const library = await readLibrary(sql, accountId);
    const counted = library.topics
      .map((topic) => ({
        topic,
        count: library.entries.filter((entry) => entry.overview.topicIds.includes(topic.id)).length,
      }))
      .sort((left, right) => right.count - left.count || left.topic.name.localeCompare(right.topic.name));
    const unfiled = library.entries.filter((entry) => entry.overview.topicIds.length === 0).length;
    const lines = counted.map(
      ({ topic, count }) =>
        `- **${topic.name}**: ${count} overview(s) · id ${topic.id}${topic.description === null ? "" : `\n  ${topic.description}`}`,
    );
    return {
      text: [
        counted.length === 0 ? "The reader has no topics yet." : `${counted.length} topic(s):`,
        ...lines,
        ...(unfiled === 0 ? [] : [`${unfiled} overview(s) are not filed under any topic.`]),
      ].join("\n"),
    };
  },
});

const getOverview = mcpTool({
  name: "get_overview",
  title: "Read one overview",
  description:
    "Read one saved overview in full, as Markdown: premise, core claim, verdict (with why it is dubious, when it is), key points, how to apply, what it sells, whether to watch it anyway, and chapters. Every chapter links to its moment in the video, for citing.",
  input: z.object({ id: z.string().describe("The overview's id") }),
  run: async ({ id }, { sql, accountId }) => {
    const library = await readLibrary(sql, accountId);
    const entry = library.entries.find((candidate) => candidate.overview.id === id);
    if (entry === undefined) {
      return toolError(`There is no overview with id ${id} in this library.`);
    }
    return { text: overviewText(library, entry), overviews: 1 };
  },
});

const getOverviews = mcpTool({
  name: "get_overviews",
  title: "Read many overviews",
  description: `Read many saved overviews in full in one call, to compare or combine what several videos say. Choose them by ids, or by the same filters as search_overviews (a topic, a search, a tag, a date range), or both. Returns at most ${OVERVIEWS_PER_CALL} per call, newest saved first, with a cursor for the rest. Never includes transcripts: use get_transcript for the source behind one claim.`,
  input: LibraryFilters.extend({
    ids: z.array(z.string()).max(OVERVIEWS_PER_CALL).optional().describe("The overviews' ids"),
    cursor: Cursor,
  }),
  run: async ({ ids, cursor, ...filters }, { sql, accountId }) => {
    const library = await readLibrary(sql, accountId);
    const resolved = resolveFilters(library, filters);
    if (isOutcome(resolved)) {
      return resolved;
    }
    const chosen = ids === undefined ? library.entries : library.entries.filter((entry) => ids.includes(entry.overview.id));
    const page = pageOf(searchLibrary(chosen, resolved), cursor, OVERVIEWS_PER_CALL);
    const missing = (ids ?? []).filter((id) => !library.entries.some((entry) => entry.overview.id === id));
    const notes = [
      ...(missing.length === 0 ? [] : [`Not in this library: ${missing.join(", ")}.`]),
      ...pageFooter(page, "overviews"),
      ...unreadableNote(library),
    ];
    const body =
      page.total === 0
        ? "No saved overviews match."
        : page.items.map((entry) => overviewText(library, entry)).join("\n---\n\n");
    return {
      text: [`${page.total} saved overview(s) match.`, ...notes, "", body].join("\n").trim(),
      overviews: page.items.length,
    };
  },
});

const getTranscript = mcpTool({
  name: "get_transcript",
  title: "Read a transcript",
  description:
    "Read the transcript of the video behind one saved overview, each paragraph stamped with the time it was said. Transcripts are long: fetch one to check what the video actually said behind a claim, not to survey many videos.",
  input: z.object({ id: z.string().describe("The overview's id") }),
  run: async ({ id }, { sql, accountId, transcripts }) => {
    const parsedId = OverviewId.safeParse(id);
    const library = await readLibrary(sql, accountId);
    const entry = parsedId.success ? library.entries.find((candidate) => candidate.overview.id === parsedId.data) : undefined;
    if (entry === undefined) {
      return toolError(`There is no overview with id ${id} in this library.`);
    }
    const videoId = entry.overview.video.id;
    const stored = videoId === null ? null : await transcripts.get(accountId, videoId);
    const transcript = StoredTranscript.safeParse(stored);
    if (!transcript.success) {
      return toolError("No transcript is kept for this video.");
    }
    const text = transcriptPlainText(entry.overview.video, transcriptBlocks(transcript.data.segments));
    return {
      text: transcript.data.generated
        ? `Machine-transcribed: the video had no captions of its own, so some words may be misheard.\n\n${text}`
        : text,
    };
  },
});

export const mcpTools: readonly McpTool[] = [searchOverviews, listTopics, getOverview, getOverviews, getTranscript];
