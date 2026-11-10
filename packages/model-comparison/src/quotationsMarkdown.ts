import { mostQuotations, transcriptBudget, type GeneratedOutput } from "@overview/generation";
import { SPOKEN_WORDS_PER_MINUTE, overviewNoteLines, wordCount, type Overview } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";
import type { RunRecord } from "./RunRecord.js";

export interface QuotationTally {
  name: string;
  notes: number;
  quoted: number;
  overBudget: number;
  standsOutQuoted: number;
  named: number;
  dropped: number;
  spokenWords: number;
  addedWords: number;
}

// A quotation the model named but code dropped: outside its line's stretch, or nothing to lift.
// A video names segments and an article sentences; either way -1 is none.
const namedQuotes = (output: Partial<GeneratedOutput>): number =>
  (output.keyPoints ?? []).filter((point) => {
    const { quoteStartSegmentIndex, quoteStartSentence } = point as { quoteStartSegmentIndex?: number; quoteStartSentence?: number };
    const start = quoteStartSegmentIndex ?? quoteStartSentence;
    return start !== undefined && start !== -1;
  }).length;

const spokenWordsOf = (overview: Overview, onlyQuotations: boolean) =>
  overviewNoteLines(overview)
    .filter((line) => !onlyQuotations || line.quotation === true)
    .reduce((total, line) => total + wordCount(line.spoken ?? line.text), 0);

// Counted by code from what the runs wrote, never estimated (docs/prototype/constraints.md).
export function tallyQuotations(runs: readonly RunRecord[], byVideo: ReadonlyMap<string, FetchedTranscript>): QuotationTally[] {
  const byModel = new Map<string, RunRecord[]>();
  for (const run of runs.filter((record) => record.overview !== null && record.overview.recipe == null)) {
    const name = `${run.provider}:${run.model}`;
    byModel.set(name, [...(byModel.get(name) ?? []), run]);
  }
  return [...byModel].map(([name, notes]) => {
    const quotedIn = (overview: Overview) => overview.keyPoints.filter((point) => point.evidence !== undefined).length;
    return {
      name,
      notes: notes.length,
      quoted: notes.reduce((total, run) => total + quotedIn(run.overview!), 0),
      overBudget: notes.filter((run) => {
        const fetched = byVideo.get(run.videoId);
        return fetched !== undefined && quotedIn(run.overview!) > mostQuotations(transcriptBudget(fetched));
      }).length,
      standsOutQuoted: notes.filter((run) => run.overview!.verdict?.standsOut?.evidence !== undefined).length,
      named: notes.reduce((total, run) => total + namedQuotes(run.attempts.at(-1) as Partial<GeneratedOutput>), 0),
      dropped: notes.reduce(
        (total, run) => total + namedQuotes(run.attempts.at(-1) as Partial<GeneratedOutput>) - quotedIn(run.overview!),
        0,
      ),
      spokenWords: notes.reduce((total, run) => total + spokenWordsOf(run.overview!, false), 0),
      addedWords: notes.reduce((total, run) => total + spokenWordsOf(run.overview!, true), 0),
    };
  });
}

const share = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 100)}%`);
const perNote = (value: number, notes: number) => (notes === 0 ? "–" : (value / notes).toFixed(1));
const seconds = (words: number, notes: number) => (notes === 0 ? "–" : `${Math.round((words / notes / SPOKEN_WORDS_PER_MINUTE) * 60)}s`);

export function quotationsMarkdown(tallies: readonly QuotationTally[], runName: string): string {
  return [
    `# Quotations: ${runName}`,
    "",
    "Counted by code from the notes the run wrote.",
    "",
    "| Model | Notes | Quoted points per note | Notes over budget | What stands out quoted | Named but dropped | Spoken length per note | Of which quotations |",
    "|---|---|---|---|---|---|---|---|",
    ...tallies.map(
      (tally) =>
        `| ${tally.name} | ${tally.notes} | ${perNote(tally.quoted, tally.notes)} | ${tally.overBudget} | ${share(tally.standsOutQuoted, tally.notes)} | ` +
        `${tally.dropped} of ${tally.named} | ${seconds(tally.spokenWords, tally.notes)} | ` +
        `${seconds(tally.addedWords, tally.notes)} (${share(tally.addedWords, tally.spokenWords)}) |`,
    ),
    "",
  ].join("\n");
}
