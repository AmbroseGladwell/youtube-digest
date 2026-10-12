import { formatTimestamp, type Overview } from "@overview/domain";
import type { GeneratedOutput } from "@overview/generation";
import type { FetchedTranscript } from "@overview/transcripts";
import { checkOverview } from "./checkOverview.js";
import type { RunRecord } from "./RunRecord.js";

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function overviewCell(record: RunRecord, fetched: FetchedTranscript): string {
  const heading = `<h3>${escape(`${record.provider}:${record.model}`)}</h3>
<p class="meta">${escape(record.outcome)} · ${(record.latencyMs / 1000).toFixed(1)}s · ${
    record.costDollars === null ? "unpriced" : `$${record.costDollars.toFixed(4)}`
  }</p>`;
  const overview: Overview | null = record.overview;
  if (overview === null) {
    return `<section class="cell">${heading}<p class="error">${escape(record.error ?? "no overview")}</p></section>`;
  }

  const failedChecks = checkOverview(record.attempts.at(-1) as GeneratedOutput, fetched).filter((check) => !check.passed);
  const verdict = overview.verdict;
  return `<section class="cell">${heading}
${failedChecks.length === 0 ? "" : `<ul class="checks">${failedChecks.map((check) => `<li>${escape(check.check)}: ${escape(check.detail ?? "")}</li>`).join("")}</ul>`}
<p class="label">In one line</p><p>${escape(overview.inOneLine)}</p>
<p class="label">Core claim</p><p>${escape(overview.coreClaim)}</p>
${verdict ? `<p class="label">Verdict: ${escape(verdict.novelty)}${verdict.dubious ? ", dubious" : ""}</p><p>${escape(verdict.reasoning)}</p>` : ""}
${verdict?.standsOut ? `<p class="label">Stands out</p><p>${escape(verdict.standsOut.text)}</p>` : ""}
${(verdict?.dubiousClaims ?? []).map((claim) => `<p class="dubious">“${escape(claim.claim)}” ${escape(claim.reason)}</p>`).join("")}
<p class="label">Key points</p><ol>${overview.keyPoints.map((point) => `<li>${escape(point.text)}</li>`).join("")}</ol>
${overview.howToApply ? `<p class="label">How to apply</p><ul>${overview.howToApply.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}
${overview.selling ? `<p class="label">Selling: ${escape(overview.selling.type)}</p><p>${escape(overview.selling.detail)}</p>` : ""}
${overview.watchAnyway ? `<p class="label">Watch anyway: ${escape(overview.watchAnyway.answer)}</p><p>${escape(overview.watchAnyway.reason)}</p>` : ""}
<p class="label">Chapters</p><ol class="chapters">${(overview.chapters ?? [])
    .map((chapter) => `<li><b>${formatTimestamp(chapter.startMs)} ${escape(chapter.title)}</b><br>${escape(chapter.summary)}</li>`)
    .join("")}</ol>
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
<h2><a href="${escape(fetched.video.url)}">${escape(fetched.video.title)}</a></h2>
<p class="meta">${escape(fetched.video.channel)} · ${formatTimestamp(fetched.video.durationMs ?? fetched.transcript.at(-1)?.endMs ?? 0)} · ${fetched.transcript.length} segments${fetched.generated ? " · auto-captions" : ""}</p>
<div class="row">${runs.map((record) => overviewCell(record, fetched)).join("\n")}</div>
</article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(runName)}</title>
<style>
:root { color-scheme: light dark; --ink: #1d1b18; --paper: #faf8f4; --rule: #d9d3c7; --muted: #6b655b; --flag: #a33a1f; }
@media (prefers-color-scheme: dark) { :root { --ink: #ece7dd; --paper: #1b1a18; --rule: #3a3731; --muted: #a39d92; --flag: #f08a6c; } }
body { margin: 0; padding: 16px; background: var(--paper); color: var(--ink); font: 14px/1.45 system-ui, sans-serif; }
article { border-top: 1px solid var(--rule); padding: 16px 0; }
.row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(300px, 1fr); gap: 16px; overflow-x: auto; }
.cell { border: 1px solid var(--rule); border-radius: 8px; padding: 12px; }
h3 { margin: 0; font-size: 14px; } .meta, .label { color: var(--muted); font-size: 12px; margin: 8px 0 2px; }
.label { text-transform: uppercase; letter-spacing: .04em; } p { margin: 0 0 4px; }
.checks, .error, .dubious { color: var(--flag); } ol, ul { padding-left: 20px; margin: 0; }
</style></head>
<body><h1>${escape(runName)}</h1>
${videos}
</body></html>
`;
}
