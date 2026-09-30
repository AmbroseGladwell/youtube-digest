import { formatTimestamp } from "./formatTimestamp.js";
import { NOVELTY_LABEL } from "./noveltyLabel.js";
import type { Overview } from "./Overview.js";
import { SELLING_LABEL } from "./sellingLabel.js";
import { WATCH_ANYWAY_LABEL } from "./watchAnywayLabel.js";
import { youtubeTimestampUrl } from "./youtubeTimestampUrl.js";

const moment = (videoUrl: string, startMs: number, label = formatTimestamp(startMs)) =>
  `[${label}](${youtubeTimestampUrl(videoUrl, startMs)})`;

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
    const { novelty, dubious, reasoning, similarTo } = overview.verdict;
    const lines = [`${NOVELTY_LABEL[novelty]}${dubious ? ", and dubious" : ""}. ${reasoning}`];
    if (similarTo.length > 0) {
      lines.push(`Similar to: ${similarTo.map((similar) => `${similar.title} (${similar.overviewId})`).join("; ")}`);
    }
    section("Verdict", lines.join("\n\n"));
  }

  section("Key points", bullets(overview.keyPoints));
  if (overview.howToApply !== null && overview.howToApply.items.length > 0) {
    section("How to apply", bullets(overview.howToApply.items));
  }
  if (overview.selling !== null && overview.selling.type !== "none") {
    section("What it sells", `${SELLING_LABEL[overview.selling.type]}. ${overview.selling.detail}`.trim());
  }
  if (overview.watchAnyway !== null) {
    const { answer, reason, range } = overview.watchAnyway;
    const where =
      range === null
        ? ""
        : ` ${moment(video.url, range.startMs, `${formatTimestamp(range.startMs)}–${formatTimestamp(range.endMs)}`)}`;
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
