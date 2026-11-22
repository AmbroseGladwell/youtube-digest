import { z } from "zod";
import {
  apiLogLines,
  formatTimestamp,
  sourceKey,
  sourceName,
  TRANSCRIPT_QUERY_MAX_LENGTH,
  youtubeTimestampUrl,
  type Overview,
  type TranscriptMoment,
} from "@overview/domain";
import { TranscriptPassagesRepository } from "../transcripts/TranscriptPassagesRepository.js";
import { TRANSCRIPT_RESULTS, transcriptMatches, type TranscriptMatch } from "../transcripts/transcriptMatches.js";
import { mcpTool, toolError } from "./McpTool.js";
import { readLibrary } from "./readLibrary.js";

export const NOT_SEARCHED_NOTE = "Only videos and podcast episodes keep a transcript, so articles and recipes are not searched.";

const emphasised = ({ text, marks }: TranscriptMoment): string =>
  [...marks]
    .reverse()
    .reduce((marked, { start, end }) => `${marked.slice(0, start)}**${marked.slice(start, end)}**${marked.slice(end)}`, text);

const momentLine = (overview: Overview, moment: TranscriptMoment): string => {
  const time = formatTimestamp(moment.startMs);
  const at = overview.source.kind === "youtube" ? `[${time}](${youtubeTimestampUrl(overview.source.url, moment.startMs)})` : time;
  return `  - ${at}: "${emphasised(moment)}"`;
};

const matchLines = ({ overview, mentions, moments }: TranscriptMatch): string[] => [
  `- **${overview.source.title}** (${sourceName(overview.source)} · said in ${mentions} minute(s) of it · id ${overview.id})`,
  ...moments.map((moment) => momentLine(overview, moment)),
];

export const searchTranscripts = mcpTool({
  name: "search_transcripts",
  title: "Search what was said",
  description: `Find exact words said in the reader's transcripts of their saved videos and podcast episodes: a name, a number or a phrase the overview may leave out. Every word must be said within one minute; put a phrase in double quotes to match it word for word. Returns the overviews that say it most first (at most ${TRANSCRIPT_RESULTS}), each with up to 3 moments: the time, linked to that point in the video, and the sentence it was said in. Pass an overview's id to search only its transcript, then read around a moment with get_transcript from that time.`,
  input: z.object({
    query: z.string().trim().min(1).max(TRANSCRIPT_QUERY_MAX_LENGTH).describe("The words to find; double quotes for an exact phrase"),
    id: z.string().optional().describe("Search only this overview's transcript, by its id"),
  }),
  run: async ({ query, id }, { sql, accountId, records, transcripts, log }) => {
    let withinSources: string[] | null = null;
    if (id !== undefined) {
      const entry = (await readLibrary(sql, accountId)).entries.find((candidate) => candidate.overview.id === id);
      if (entry === undefined) {
        return toolError(`There is no overview with id ${id} in this library.`);
      }
      const key = entry.overview.source.kind === "web" ? null : sourceKey(entry.overview.source);
      if (key === null) {
        return toolError("Articles and recipes keep no transcript to search. Read the overview with get_overview.");
      }
      withinSources = [key];
    }
    const matches = await transcriptMatches({ passages: new TranscriptPassagesRepository(sql), records, transcripts }, accountId, query, {
      withinSources,
    });
    log.info(apiLogLines.transcripts.searched({ source: "mcp", matches: matches.length }));
    const lines =
      matches.length === 0
        ? ["Nothing in the reader's transcripts says that."]
        : [`${matches.length} saved overview(s) say it, most first.`, "", ...matches.flatMap(matchLines)];
    const notes = [
      ...(matches.length === TRANSCRIPT_RESULTS
        ? [`These are the ${TRANSCRIPT_RESULTS} that say it most; add words or quote a phrase to narrow it.`]
        : []),
      ...(id === undefined ? [NOT_SEARCHED_NOTE] : []),
    ];
    return { text: [...lines, "", ...notes].join("\n").trim(), overviews: matches.length };
  },
});
