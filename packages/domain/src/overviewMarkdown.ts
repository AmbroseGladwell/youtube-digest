import { articlePlaceUrl } from "./ArticlePlace.js";
import { noteSourceLength, sourceName, sourceUrl } from "./sourceFacts.js";
import { recipeFigures, recipeFiguresLine, recipeStepGroups } from "./recipeFacts.js";
import { DUBIOUS_BASIS_LABEL } from "./dubiousBasisLabel.js";
import { formatTimestamp } from "./formatTimestamp.js";
import { NOVELTY_BASIS, NOVELTY_LABEL, STANDS_OUT_LABEL } from "./noveltyLabel.js";
import type { Overview } from "./Overview.js";
import type { TimeRange } from "./WatchAnyway.js";
import { SELLING_LABEL } from "./sellingLabel.js";
import type { DubiousClaim } from "./Verdict.js";
import { LISTEN_ANYWAY_LABEL, WATCH_ANYWAY_LABEL } from "./watchAnywayLabel.js";
import { youtubeTimestampUrl } from "./youtubeTimestampUrl.js";

const READ_ANYWAY_ANSWER = { yes: "Yes", no: "No", partial: "Just part of it" } as const;

// An episode's moment is its time alone: a link into the feed's audio would land wherever that
// listen's ads put it (docs/features/podcast-notes.md, "Times and the episode's audio").
const moment = (videoUrl: string | null, startMs: number, label = formatTimestamp(startMs)) =>
  videoUrl === null ? label : `[${label}](${youtubeTimestampUrl(videoUrl, startMs)})`;

const stretch = (videoUrl: string | null, range: TimeRange) =>
  moment(videoUrl, range.startMs, `${formatTimestamp(range.startMs)}–${formatTimestamp(range.endMs)}`);

const bullets = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

// The note as it reads outside the app: every section the reader sees, with each moment
// a link into the video, and never the spoken script (docs/features/mcp-connector.md).
export function overviewMarkdown(overview: Overview): string {
  const { source: video } = overview;
  const link = sourceUrl(video);
  const timed = video.kind === "podcast" ? null : link;
  const facts = [
    sourceName(video),
    video.kind === "web" ? (video.author === null ? null : `by ${video.author}`) : null,
    video.kind === "youtube" ? (video.durationMs === null ? null : formatTimestamp(video.durationMs)) : noteSourceLength(overview),
    video.publishedAt === null ? null : `published ${video.publishedAt.slice(0, 10)}`,
    `saved ${overview.savedAt.slice(0, 10)}`,
  ].filter((fact) => fact !== null);

  const sections: string[] = [`# ${video.title}`, `${facts.join(" · ")}\n${link}\n\nTags: ${overview.tags.join(", ")}`];
  const section = (heading: string, body: string) => sections.push(`## ${heading}\n\n${body}`);
  const chaptersSection = () => {
    if (overview.chapters !== null && overview.chapters.length > 0) {
      section(
        "Chapters",
        bullets(overview.chapters.map((chapter) => `${moment(timed, chapter.startMs)} **${chapter.title}**: ${chapter.summary}`)),
      );
    }
  };

  if (overview.captureReason !== null && overview.captureReason.trim() !== "") {
    section("Why I saved it", overview.captureReason.trim());
  }
  const { recipe } = overview;
  if (recipe !== null) {
    const figures = recipeFigures(recipe);
    section("Summary", figures.length === 0 ? recipe.summary : `${recipeFiguresLine(figures)}\n\n${recipe.summary}`);
    section("Ingredients", bullets(recipe.ingredients));
    section(
      "Method",
      recipe.steps.length === 0
        ? `${recipe.stepCount} steps, on the page: ${link}`
        : recipeStepGroups(recipe.steps)
            .map(({ name, start, steps }) =>
              [
                name === null ? null : `### ${name}`,
                steps
                  .map((step, index) => {
                    const range = recipe.steps[start + index - 1]?.range;
                    return `${start + index}. ${step}${range === undefined ? "" : ` (${moment(timed, range.startMs)})`}`;
                  })
                  .join("\n"),
              ]
                .filter((part) => part !== null)
                .join("\n\n"),
            )
            .join("\n\n"),
    );
    chaptersSection();
    return `${sections.join("\n\n")}\n`;
  }

  section("Premise", overview.inOneLine);
  if (overview.bigPicture) {
    section("Big picture", overview.bigPicture);
  }
  section(overview.thin ? "No clear claim" : "Core claim", overview.coreClaim);

  if (overview.verdict !== null) {
    const { novelty, standsOut, dubious, dubiousClaims, reasoning, similarTo } = overview.verdict;
    const lines = [`${NOVELTY_LABEL[novelty]}${dubious ? ", and dubious" : ""}. ${reasoning}`];
    if (standsOut !== null) {
      const at = standsOut.range === null ? "" : ` (${stretch(timed, standsOut.range)})`;
      lines.push(`${STANDS_OUT_LABEL}${at}: ${standsOut.text}`);
    }
    if (dubious && dubiousClaims === null) {
      lines.push("Why it is dubious: no reason was saved with this overview.");
    }
    if (dubiousClaims !== null && dubiousClaims.length > 0) {
      const claimLine = (dubiousClaim: DubiousClaim) =>
        [
          dubiousClaim.startMs === null ? null : moment(timed, dubiousClaim.startMs),
          `“${dubiousClaim.claim}”: ${DUBIOUS_BASIS_LABEL[dubiousClaim.basis]}. ${dubiousClaim.reason}`,
        ]
          .filter((part) => part !== null)
          .join(" ");
      lines.push(`Why it is dubious:\n\n${bullets(dubiousClaims.map(claimLine))}`);
    }
    if (similarTo.length > 0) {
      lines.push(`Similar to: ${similarTo.map((similar) => `${similar.title} (${similar.overviewId})`).join("; ")}`);
    }
    lines.push(`_${NOVELTY_BASIS}_`);
    section("Verdict", lines.join("\n\n"));
  }

  section(
    "Key points",
    bullets(overview.keyPoints.map(({ text, range }) => (range === null ? text : `${text} (${stretch(timed, range)})`))),
  );
  if (overview.sourceSteps !== null) {
    section(
      "The steps it gives",
      overview.sourceSteps.items
        .map(
          ({ text, range, dubiousReason }, index) =>
            `${index + 1}. ${text}${dubiousReason === null ? "" : ` _(dubious: ${dubiousReason})_`}${range === null ? "" : ` (${moment(timed, range.startMs)})`}`,
        )
        .join("\n"),
    );
  }
  if (overview.howToApply !== null && overview.howToApply.items.length > 0) {
    section("How to apply", bullets(overview.howToApply.items));
  }
  if (overview.selling !== null && overview.selling.type !== "none") {
    section("What it sells", `${SELLING_LABEL[overview.selling.type]}. ${overview.selling.detail}`.trim());
  }
  if (overview.watchAnyway !== null) {
    const { answer, reason, range } = overview.watchAnyway;
    const where = range === null ? "" : ` ${stretch(timed, range)}`;
    section(
      video.kind === "podcast" ? "Listen to it anyway?" : "Watch it anyway?",
      `${(video.kind === "podcast" ? LISTEN_ANYWAY_LABEL : WATCH_ANYWAY_LABEL)[answer]}. ${reason}${where}`.trim(),
    );
  }
  const article = overview.article;
  if (article?.readAnyway) {
    const { answer, reason, leftOut } = article.readAnyway;
    section("Read it anyway?", `${READ_ANYWAY_ANSWER[answer]}. ${reason} ${leftOut}`.trim());
  }
  if (article?.resources) {
    section(
      "Resources it links to",
      bullets(
        article.resources.map(({ text, href, why, place, chapter }) => {
          const from = article.chapters[chapter]!.title;
          return `[${text}](${href}): ${why} From [${from}](${articlePlaceUrl(link, place)}).`;
        }),
      ),
    );
  }
  if (article !== null) {
    section(
      "Chapters",
      bullets(article.chapters.map(({ title, summary, place }) => `[${title}](${articlePlaceUrl(link, place)}): ${summary}`)),
    );
  }
  chaptersSection();

  return `${sections.join("\n\n")}\n`;
}
