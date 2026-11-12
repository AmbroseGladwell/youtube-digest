import { SPOKEN_WORDS_PER_MINUTE, overviewNoteLines, wordCount, type Overview } from "@overview/domain";
import type { ActionableItemsRecord } from "./extractActionableItems.js";
import type { CarriedVerdict, StepsJudgeRecord } from "./judgeStepsCarried.js";
import { reasonClaims } from "./reasonClaims.js";
import type { RunRecord } from "./RunRecord.js";
import type { StepsSource } from "./StepsSource.js";

export interface StepsNote {
  sourceId: string;
  title: string;
  writer: string;
  watchAnswer: string | null;
  spokenSeconds: number;
  items: { text: string; place: string | null; verdict: CarriedVerdict | null; reason: string | null }[] | "no steps" | "not listed";
  claims: string[];
}

const spokenSecondsOf = (overview: Overview) =>
  Math.round(
    (overviewNoteLines(overview).reduce((total, line) => total + wordCount(line.spoken ?? line.text), 0) / SPOKEN_WORDS_PER_MINUTE) * 60,
  );

// Joined by code from what the two passes recorded, never estimated (docs/prototype/constraints.md).
export function stepsNotes(
  runs: readonly RunRecord[],
  sources: ReadonlyMap<string, StepsSource>,
  lists: readonly ActionableItemsRecord[],
  judgments: readonly StepsJudgeRecord[],
): StepsNote[] {
  const listOf = new Map(lists.filter((list) => list.items !== null).map((list) => [list.sourceId, list.items!]));
  return runs
    .filter((run) => run.overview !== null && run.overview.recipe == null && sources.has(run.videoId))
    .map((run) => {
      const overview = run.overview!;
      const source = sources.get(run.videoId)!;
      const writer = `${run.provider}:${run.model}`;
      const items = listOf.get(run.videoId);
      const judged = judgments.find((record) => record.writer === writer && record.videoId === run.videoId && record.labels !== null);
      return {
        sourceId: run.videoId,
        title: source.title,
        writer,
        watchAnswer: overview.watchAnyway?.answer ?? null,
        spokenSeconds: spokenSecondsOf(overview),
        items:
          items === undefined
            ? "not listed"
            : items.length === 0
              ? "no steps"
              : items.map((item, index) => ({
                  text: item.text,
                  place: item.start < 0 ? null : source.placeOf(item.start),
                  verdict: judged?.labels?.items[index]?.verdict ?? null,
                  reason: judged?.labels?.items[index]?.reason ?? null,
                })),
        claims: overview.watchAnyway ? reasonClaims(overview.watchAnyway.reason) : [],
      };
    });
}

const share = (part: number, whole: number) => (whole === 0 ? "–" : `${Math.round((part / whole) * 100)}%`);

export function stepsMarkdown(notes: readonly StepsNote[], runName: string): string {
  const writers = [...new Set(notes.map((note) => note.writer))].sort();
  const judgedItems = (note: StepsNote) => (Array.isArray(note.items) ? note.items.filter((item) => item.verdict !== null) : []);
  const summary = writers.map((writer) => {
    const mine = notes.filter((note) => note.writer === writer);
    const withSteps = mine.filter((note) => judgedItems(note).length > 0);
    const items = withSteps.flatMap(judgedItems);
    const count = (verdict: CarriedVerdict) => items.filter((item) => item.verdict === verdict).length;
    const missingSomething = withSteps.filter((note) => judgedItems(note).some((item) => item.verdict === "missing"));
    const skipYetMissing = missingSomething.filter((note) => note.watchAnswer === "no");
    const seconds = [...mine.map((note) => note.spokenSeconds)].sort((a, b) => a - b);
    return (
      `| ${writer} | ${mine.length} | ${mine.filter((note) => note.items === "no steps").length} | ${withSteps.length} | ${items.length} | ` +
      `${share(count("carried"), items.length)} | ${share(count("partly"), items.length)} | ${share(count("missing"), items.length)} | ` +
      `${missingSomething.length} | **${skipYetMissing.length}** | ${mine.filter((note) => note.claims.length > 0).length} | ${seconds[Math.floor(seconds.length / 2)] ?? "–"}s |`
    );
  });

  const perNote = notes
    .filter((note) => Array.isArray(note.items) || note.claims.length > 0)
    .sort((a, b) => a.title.localeCompare(b.title) || a.writer.localeCompare(b.writer))
    .map((note) => {
      const lines = [
        `### ${note.title}`,
        `${note.writer} · watch it anyway: ${note.watchAnswer ?? "none"} · ${note.spokenSeconds}s spoken`,
      ];
      if (Array.isArray(note.items)) {
        const by = (verdict: CarriedVerdict) =>
          note.items !== "no steps" && note.items !== "not listed" ? note.items.filter((item) => item.verdict === verdict) : [];
        const line = (item: { text: string; place: string | null }) => `- ${item.text}${item.place ? ` (${item.place})` : ""}`;
        lines.push("", `**Missing:** ${by("missing").length === 0 ? "none" : ""}`, ...by("missing").map(line));
        if (by("partly").length > 0) lines.push("", "**Partly:**", ...by("partly").map(line));
        lines.push("", `Carried: ${by("carried").length} of ${note.items.length}`);
      }
      if (note.claims.length > 0)
        lines.push("", `**Counts or times in the reason:** ${note.claims.map((claim) => `"${claim}"`).join(", ")}`);
      return lines.join("\n");
    });

  return [
    `# Steps carried: ${runName}`,
    "",
    "Of what each source tells the reader to do, how much the note carries. Listed and judged by a model of a provider that wrote none of the notes; joined and counted by code.",
    "",
    "| Writer | Notes | No steps | With steps | Items | Carried | Partly | Missing | Notes missing any | Of those, saying skip it | Reasons that count or time | Median spoken length |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...summary,
    "",
    ...perNote.flatMap((block) => [block, ""]),
  ].join("\n");
}
