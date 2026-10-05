import { DUBIOUS_BASIS_LABEL } from "./dubiousBasisLabel.js";
import { formatTimestamp } from "./formatTimestamp.js";
import { NOVELTY_BASIS, NOVELTY_LABEL, STANDS_OUT_LABEL } from "./noveltyLabel.js";
import type { Overview } from "./Overview.js";
import type { TimeRange } from "./WatchAnyway.js";
import { SELLING_LABEL } from "./sellingLabel.js";
import type { DubiousClaim } from "./Verdict.js";
import { WATCH_ANYWAY_LABEL } from "./watchAnywayLabel.js";
import { youtubeTimestampUrl } from "./youtubeTimestampUrl.js";

const moment = (videoUrl: string, startMs: number, label = formatTimestamp(startMs)) =>
  `[${label}](${youtubeTimestampUrl(videoUrl, startMs)})`;

const stretch = (videoUrl: string, range: TimeRange) =>
  moment(videoUrl, range.startMs, `${formatTimestamp(range.startMs)}–${formatTimestamp(range.endMs)}`);

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

// The note as it reads outside the app: every section the reader sees, with each moment
// a link into the video, and never the spoken script (docs/features/mcp-connector.md).
export function overviewMarkdown(overview: Overview): string {
  const { video } = overview;
  const facts = [
    video.channel,
    video.durationMs === null ? null : formatTimestamp(video.durationMs),
    video.publishedAt === null ? null : `published ${video.publishedAt.slice(0, 10)}`,
    `saved ${overview.savedAt.slice(0, 10)}`,
  ].filter((fact) => fact !== null);

  const sections: string[] = [
    `# ${video.title}`,
    `${facts.join(" · ")}\n${video.url}\n\nTags: ${overview.tags.join(", ")}`,
  ];
  const section = (heading: string, body: string) => sections.push(`## ${heading}\n\n${body}`);

  if (overview.captureReason !== null && overview.captureReason.trim() !== "") {
    section("Why I saved it", overview.captureReason.trim());
  }
  section("Premise", overview.inOneLine);
  section(overview.thin ? "No clear claim" : "Core claim", overview.coreClaim);

  if (overview.verdict !== null) {
    const { novelty, standsOut, dubious, dubiousClaims, reasoning, similarTo } = overview.verdict;
    const lines = [`${NOVELTY_LABEL[novelty]}${dubious ? ", and dubious" : ""}. ${reasoning}`];
    if (standsOut !== null) {
      const at = standsOut.range === null ? "" : ` (${stretch(video.url, standsOut.range)})`;
      lines.push(`${STANDS_OUT_LABEL}${at}: ${standsOut.text}`);
    }
    lines.push(`_${NOVELTY_BASIS}_`);
    if (dubious && dubiousClaims === null) {
      lines.push("Why it is dubious: no reason was saved with this overview.");
    }
    if (dubiousClaims !== null && dubiousClaims.length > 0) {
      const claimLine = (dubiousClaim: DubiousClaim) =>
        [
          dubiousClaim.startMs === null ? null : moment(video.url, dubiousClaim.startMs),
          `“${dubiousClaim.claim}”: ${DUBIOUS_BASIS_LABEL[dubiousClaim.basis]}. ${dubiousClaim.reason}`,
        ]
          .filter((part) => part !== null)
          .join(" ");
      lines.push(`Why it is dubious:\n\n${bullets(dubiousClaims.map(claimLine))}`);
    }
    if (similarTo.length > 0) {
      lines.push(`Similar to: ${similarTo.map((similar) => `${similar.title} (${similar.overviewId})`).join("; ")}`);
    }
    section("Verdict", lines.join("\n\n"));
  }

  section(
    "Key points",
    bullets(overview.keyPoints.map(({ text, range }) => (range === null ? text : `${text} (${stretch(video.url, range)})`))),
  );
  if (overview.howToApply !== null && overview.howToApply.items.length > 0) {
    section("How to apply", bullets(overview.howToApply.items));
  }
  if (overview.selling !== null && overview.selling.type !== "none") {
    section("What it sells", `${SELLING_LABEL[overview.selling.type]}. ${overview.selling.detail}`.trim());
  }
  if (overview.watchAnyway !== null) {
    const { answer, reason, range } = overview.watchAnyway;
    const where = range === null ? "" : ` ${stretch(video.url, range)}`;
    section("Watch it anyway?", `${WATCH_ANYWAY_LABEL[answer]}. ${reason}${where}`.trim());
  }
  if (overview.chapters !== null && overview.chapters.length > 0) {
    section(
      "Chapters",
      bullets(overview.chapters.map((chapter) => `${moment(video.url, chapter.startMs)} **${chapter.title}**: ${chapter.summary}`)),
    );
  }

  return `${sections.join("\n\n")}\n`;
}
