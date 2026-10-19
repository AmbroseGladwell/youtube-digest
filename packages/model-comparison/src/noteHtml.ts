import { formatTimestamp, type Overview } from "@overview/domain";

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const NOTE_CSS = `:root { color-scheme: light dark; --ink: #1d1b18; --paper: #faf8f4; --rule: #d9d3c7; --muted: #6b655b; --flag: #a33a1f; --accent: #2f5d50; }
@media (prefers-color-scheme: dark) { :root { --ink: #ece7dd; --paper: #1b1a18; --rule: #3a3731; --muted: #a39d92; --flag: #f08a6c; --accent: #8cc7b4; } }
body { margin: 0; padding: 16px; background: var(--paper); color: var(--ink); font: 14px/1.45 system-ui, sans-serif; }
article { border-top: 1px solid var(--rule); padding: 16px 0; }
.row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(300px, 1fr); gap: 16px; overflow-x: auto; }
.cell { border: 1px solid var(--rule); border-radius: 8px; padding: 12px; }
h3 { margin: 0; font-size: 14px; } .meta, .label { color: var(--muted); font-size: 12px; margin: 8px 0 2px; }
.label { text-transform: uppercase; letter-spacing: .04em; } p { margin: 0 0 4px; }
.checks, .error, .dubious { color: var(--flag); } ol, ul { padding-left: 20px; margin: 0; }`;

export function noteHtml(overview: Overview): string {
  const verdict = overview.verdict;
  return `<p class="label">In one line</p><p>${escapeHtml(overview.inOneLine)}</p>
<p class="label">Core claim</p><p>${escapeHtml(overview.coreClaim)}</p>
${verdict ? `<p class="label">Verdict: ${escapeHtml(verdict.novelty)}${verdict.dubious ? ", dubious" : ""}</p><p>${escapeHtml(verdict.reasoning)}</p>` : ""}
${verdict?.standsOut ? `<p class="label">Stands out</p><p>${escapeHtml(verdict.standsOut.text)}</p>` : ""}
${(verdict?.dubiousClaims ?? []).map((claim) => `<p class="dubious">“${escapeHtml(claim.claim)}” ${escapeHtml(claim.reason)}</p>`).join("")}
<p class="label">Key points</p><ol>${overview.keyPoints.map((point) => `<li>${escapeHtml(point.text)}</li>`).join("")}</ol>
${overview.howToApply ? `<p class="label">How to apply</p><ul>${overview.howToApply.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
${overview.selling ? `<p class="label">Selling: ${escapeHtml(overview.selling.type)}</p><p>${escapeHtml(overview.selling.detail)}</p>` : ""}
${overview.watchAnyway ? `<p class="label">Watch anyway: ${escapeHtml(overview.watchAnyway.answer)}</p><p>${escapeHtml(overview.watchAnyway.reason)}</p>` : ""}
<p class="label">Chapters</p><ol class="chapters">${(overview.chapters ?? [])
    .map((chapter) => `<li><b>${formatTimestamp(chapter.startMs)} ${escapeHtml(chapter.title)}</b><br>${escapeHtml(chapter.summary)}</li>`)
    .join("")}</ol>`;
}
