import { formatTimestamp, wordCount } from "@overview/domain";
import { bigPictureBudget } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import type { BigPictureJudgeRecord } from "./judgeBigPicture.js";
import type { RunRecord } from "./RunRecord.js";
import { videoLengthMs } from "./summariseRuns.js";

export const transcriptWords = (fetched: FetchedTranscript): number =>
  fetched.transcript.reduce((total, segment) => total + wordCount(segment.text), 0);

const percent = (part: number, whole: number) => (whole === 0 ? "n/a" : `${part}/${whole} (${Math.round((part / whole) * 100)}%)`);

const judgmentKey = (writer: string, videoId: string) => `${writer}:${videoId}`;

// The deletion test is the acceptance property (OV-225): a big picture that loses nothing
// when removed has failed, and a high rate means the prompt's split is not landing.
export function bigPictureMarkdown(
  runs: readonly RunRecord[],
  judgments: readonly BigPictureJudgeRecord[],
  byVideo: ReadonlyMap<string, FetchedTranscript>,
  runName: string,
): string {
  const notes = runs.filter((run) => run.overview !== null && run.overview.recipe === null && byVideo.has(run.videoId));
  const judged = new Map(
    judgments.filter((record) => record.outcome === "judged").map((record) => [judgmentKey(record.writer, record.videoId), record]),
  );
  const writers = [...new Set(notes.map((run) => `${run.provider}:${run.model}`))].sort();

  const sections = writers.map((writer) => {
    const own = notes
      .filter((run) => `${run.provider}:${run.model}` === writer)
      .map((run) => {
        const fetched = byVideo.get(run.videoId)!;
        const target = bigPictureBudget(transcriptWords(fetched));
        const bigPicture = run.overview!.bigPicture;
        return { run, fetched, target, bigPicture, words: bigPicture === null ? 0 : wordCount(bigPicture) };
      })
      .sort((left, right) => videoLengthMs(left.fetched) - videoLengthMs(right.fetched));
    const earned = own.filter((note) => note.target > 0);
    const written = earned.filter((note) => note.bigPicture !== null);
    const labelled = written.flatMap((note) => judged.get(judgmentKey(writer, note.run.videoId))?.labels ?? []);
    const count = (test: (labels: (typeof labelled)[number]) => boolean) => labelled.filter(test).length;

    const rows = own.map(({ run, fetched, target, bigPicture, words }) => {
      const labels = judged.get(judgmentKey(writer, run.videoId))?.labels ?? undefined;
      const cells = [
        fetched.video.title.replace(/\|/g, "/"),
        formatTimestamp(videoLengthMs(fetched)),
        target === 0 ? "none" : String(target),
        bigPicture === null ? "none" : String(words),
        labels === undefined ? "" : labels.deletion,
        labels === undefined ? "" : labels.reason.replace(/\|/g, "/"),
      ];
      return `| ${cells.join(" | ")} |`;
    });

    return [
      `## ${writer}`,
      "",
      `- Notes: ${own.length}, of which ${own.length - earned.length} too short to earn a big picture`,
      `- Earned one and wrote one: ${percent(written.length, earned.length)}`,
      `- Over the target: ${percent(written.filter((note) => note.words > note.target).length, written.length)}`,
      `- Judged: ${labelled.length} of ${written.length}`,
      `- **Passes the deletion test: ${percent(
        count((labels) => labels.deletion === "loses-something"),
        labelled.length,
      )}**`,
      `- Names the question or why it matters: ${percent(
        count((labels) => labels.namesTheQuestion),
        labelled.length,
      )}`,
      `- Names another thread: ${percent(
        count((labels) => labels.namesAnotherThread),
        labelled.length,
      )}`,
      `- Describes the source rather than the subject (a fault): ${percent(
        count((labels) => labels.describesTheSource),
        labelled.length,
      )}`,
      "",
      "| Video | Length | Target words | Words | Deletion test | Why |",
      "|---|---|---|---|---|---|",
      ...rows,
    ].join("\n");
  });

  return [`# Big picture: ${runName}`, "", ...sections.flatMap((section) => [section, ""])].join("\n");
}
