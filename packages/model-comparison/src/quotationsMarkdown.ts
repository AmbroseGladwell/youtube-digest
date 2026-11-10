import { mostQuotations, transcriptBudget, type GeneratedOutput } from "@overview/generation";
import { SPOKEN_WORDS_PER_MINUTE, overviewNoteLines, wordCount, type Overview } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";
import type { QuoteAddsJudgeRecord, QuoteAddsVerdict } from "./judgeQuoteAdds.js";
import type { RunRecord } from "./RunRecord.js";

export interface QuotationTally {
  name: string;
  notes: number;
  quoted: number;
  overBudget: number;
  standsOutQuoted: number;
  named: number;
  dropped: number;
  withAdds: number;
  spokenWords: number;
  addedWords: number;
  verdicts: Record<QuoteAddsVerdict, number>;
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
export function tallyQuotations(
  runs: readonly RunRecord[],
  judgments: readonly QuoteAddsJudgeRecord[],
  byVideo: ReadonlyMap<string, FetchedTranscript>,
): QuotationTally[] {
  const byModel = new Map<string, RunRecord[]>();
  for (const run of runs.filter((record) => record.overview !== null && record.overview.recipe == null)) {
    const name = `${run.provider}:${run.model}`;
    byModel.set(name, [...(byModel.get(name) ?? []), run]);
  }
  return [...byModel].map(([name, notes]) => {
    const verdicts: Record<QuoteAddsVerdict, number> = { adds: 0, restates: 0, whyItMatters: 0 };
    for (const judgment of judgments.filter((record) => record.writer === name)) {
      for (const line of judgment.labels?.lines ?? []) verdicts[line.verdict] += 1;
    }
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
      withAdds: notes.reduce((total, run) => total + run.overview!.keyPoints.filter((point) => point.evidence?.adds).length, 0),
      spokenWords: notes.reduce((total, run) => total + spokenWordsOf(run.overview!, false), 0),
      addedWords: notes.reduce((total, run) => total + spokenWordsOf(run.overview!, true), 0),
      verdicts,
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
    "Counted by code from the notes the run wrote; the verdicts on what a quotation adds come from a judge of another provider.",
    "",
    "| Model | Notes | Quoted points per note | Notes over budget | What stands out quoted | Named but dropped | Quotations with an added line | Spoken length per note | Of which quotations |",
    "|---|---|---|---|---|---|---|---|---|",
    ...tallies.map(
      (tally) =>
        `| ${tally.name} | ${tally.notes} | ${perNote(tally.quoted, tally.notes)} | ${tally.overBudget} | ${share(tally.standsOutQuoted, tally.notes)} | ` +
        `${tally.dropped} of ${tally.named} | ${share(tally.withAdds, tally.quoted)} | ${seconds(tally.spokenWords, tally.notes)} | ` +
        `${seconds(tally.addedWords, tally.notes)} (${share(tally.addedWords, tally.spokenWords)}) |`,
    ),
    "",
    "## What the added line does",
    "",
    "| Model | Judged | Adds something | Restates | Why it matters |",
    "|---|---|---|---|---|",
    ...tallies.map((tally) => {
      const judged = tally.verdicts.adds + tally.verdicts.restates + tally.verdicts.whyItMatters;
      return `| ${tally.name} | ${judged} | ${share(tally.verdicts.adds, judged)} | ${share(tally.verdicts.restates, judged)} | ${share(tally.verdicts.whyItMatters, judged)} |`;
    }),
    "",
  ].join("\n");
}
