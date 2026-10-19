import { NOTE_CSS } from "./noteHtml.js";

export const blindPageHtml = (): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blind check</title>
<style>
${NOTE_CSS}
header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap; }
h1 { font-size: 18px; margin: 0; } h2 { font-size: 16px; margin: 12px 0 4px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
@media (max-width: 720px) { .pair { grid-template-columns: 1fr; } }
.choices { position: sticky; bottom: 0; display: flex; gap: 8px; justify-content: center; padding: 12px; background: var(--paper); border-top: 1px solid var(--rule); }
button { font: inherit; padding: 8px 20px; border-radius: 8px; border: 1px solid var(--rule); background: transparent; color: var(--ink); cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--paper); }
button:disabled { opacity: .5; cursor: default; }
.done { margin-top: 32px; }
</style></head>
<body>
<header><h1>Which note would you rather have?</h1><p class="meta" id="progress"></p></header>
<p class="meta">Neither note is named, and which side each model is on is random every time. Keys: A, B, T for a tie.</p>
<main id="main"><p class="meta">Loading…</p></main>
<script>
let current = null;
const main = document.getElementById("main");
const progress = document.getElementById("progress");

async function load() {
  const next = await (await fetch("/api/next")).json();
  progress.textContent = next.picked + " picked of " + next.total + " pairs";
  if (next.done) {
    current = null;
    main.innerHTML = '<p class="done">Every pair has a pick. Run the report to see how far the judge agrees with you.</p>';
    return;
  }
  current = next.token;
  main.innerHTML =
    '<h2><a href="' + next.url + '" target="_blank" rel="noreferrer">' + next.title + '</a></h2>' +
    '<p class="meta">' + next.facts + '</p>' +
    '<div class="pair"><section class="cell"><h3>A</h3>' + next.a + '</section>' +
    '<section class="cell"><h3>B</h3>' + next.b + '</section></div>' +
    '<div class="choices"><button class="primary" data-choice="A">A is better</button>' +
    '<button data-choice="tie">About the same</button>' +
    '<button class="primary" data-choice="B">B is better</button></div>';
  window.scrollTo(0, 0);
}

async function pick(choice) {
  if (current === null) return;
  const token = current;
  current = null;
  document.querySelectorAll("button").forEach((button) => (button.disabled = true));
  const response = await fetch("/api/pick", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, choice }),
  });
  if (!response.ok) {
    main.insertAdjacentHTML("beforeend", '<p class="error">That pick was not saved: ' + (await response.text()) + '</p>');
    return;
  }
  await load();
}

main.addEventListener("click", (event) => {
  const choice = event.target.closest("button")?.dataset.choice;
  if (choice) pick(choice);
});
document.addEventListener("keydown", (event) => {
  const choice = { a: "A", b: "B", t: "tie" }[event.key.toLowerCase()];
  if (choice) pick(choice);
});
load();
</script>
</body></html>
`;
