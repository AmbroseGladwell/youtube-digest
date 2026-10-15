import { formatTimestamp } from "@overview/domain";
import type { GeneratedOutput } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import { checkOverview } from "./checkOverview.js";
import type { RunRecord } from "./RunRecord.js";
import { NOTE_CSS, escapeHtml, noteHtml } from "./noteHtml.js";

function overviewCell(record: RunRecord, fetched: FetchedTranscript): string {
  const heading = `<h3>${escapeHtml(`${record.provider}:${record.model}`)}</h3>
<p class="meta">${escapeHtml(record.outcome)} · ${(record.latencyMs / 1000).toFixed(1)}s · ${
    record.costDollars === null ? "unpriced" : `$${record.costDollars.toFixed(4)}`
  }</p>`;
  if (record.overview === null) {
    return `<section class="cell">${heading}<p class="error">${escapeHtml(record.error ?? "no overview")}</p></section>`;
  }

  const failedChecks = checkOverview(record.attempts.at(-1) as GeneratedOutput, fetched).filter((check) => !check.passed);
  return `<section class="cell">${heading}
${failedChecks.length === 0 ? "" : `<ul class="checks">${failedChecks.map((check) => `<li>${escapeHtml(check.check)}: ${escapeHtml(check.detail ?? "")}</li>`).join("")}</ul>`}
${noteHtml(record.overview)}
</section>`;
}

export function sideBySideHtml(
  runName: string,
  records: readonly RunRecord[],
  transcripts: readonly FetchedTranscript[],
): string {
  const videos = transcripts
    .map((fetched) => {
      const id = fetched.video.id ?? fetched.video.url;
      const runs = records
        .filter((record) => record.videoId === id)
        .sort((left, right) => `${left.provider}:${left.model}`.localeCompare(`${right.provider}:${right.model}`));
      if (runs.length === 0) return "";
      return `<article>
<h2><a href="${escapeHtml(fetched.video.url)}">${escapeHtml(fetched.video.title)}</a></h2>
<p class="meta">${escapeHtml(fetched.video.channel)} · ${formatTimestamp(fetched.video.durationMs ?? fetched.transcript.at(-1)?.endMs ?? 0)} · ${fetched.transcript.length} segments${fetched.generated ? " · auto-captions" : ""}</p>
<div class="row">${runs.map((record) => overviewCell(record, fetched)).join("\n")}</div>
</article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(runName)}</title>
<style>
${NOTE_CSS}
</style></head>
<body><h1>${escapeHtml(runName)}</h1>
${videos}
</body></html>
`;
}
