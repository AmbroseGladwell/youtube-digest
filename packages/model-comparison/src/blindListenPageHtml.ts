import { NOTE_CSS } from "./noteHtml.js";

export const blindListenPageHtml = (): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blind listen</title>
<style>
${NOTE_CSS}
header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap; }
h1 { font-size: 18px; margin: 0; } h2 { font-size: 16px; margin: 12px 0 4px; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
@media (max-width: 720px) { .pair { grid-template-columns: 1fr; } }
audio { width: 100%; margin-top: 8px; }
details { margin-top: 16px; } summary { cursor: pointer; color: var(--muted); }
textarea { box-sizing: border-box; width: 100%; min-height: 64px; margin-top: 16px; font: inherit; padding: 8px; border-radius: 8px; border: 1px solid var(--rule); background: transparent; color: var(--ink); }
.choices { position: sticky; bottom: 0; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; padding: 12px; background: var(--paper); border-top: 1px solid var(--rule); }
button { font: inherit; padding: 8px 20px; border-radius: 8px; border: 1px solid var(--rule); background: transparent; color: var(--ink); cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--paper); }
button:disabled { opacity: .5; cursor: default; }
.done { margin-top: 32px; }
</style></head>
<body>
<header><h1>Which would you rather listen to?</h1><p class="meta" id="progress"></p></header>
<p class="meta">Both are the same source's overview in the app's voice. Which prompt wrote which is hidden, and the sides are random every time.</p>
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
    main.innerHTML = '<p class="done">Every pair has a pick. The report is written to ' + next.report + '.</p>';
    return;
  }
  current = next.token;
  main.innerHTML =
    '<h2><a href="' + next.url + '" target="_blank" rel="noreferrer">' + next.title + '</a></h2>' +
    '<p class="meta">' + next.facts + '</p>' +
    '<div class="pair">' +
    '<section class="cell"><h3>A</h3><audio controls preload="metadata" src="/audio/' + next.token + '/A"></audio></section>' +
    '<section class="cell"><h3>B</h3><audio controls preload="metadata" src="/audio/' + next.token + '/B"></audio></section></div>' +
    '<label for="reason" class="label">Why, in a sentence</label>' +
    '<textarea id="reason" placeholder="Listened like an inventory, said the same thing twice, too long for what it gave…"></textarea>' +
    '<details><summary>Show the notes as text, after listening</summary><div class="pair">' +
    '<section class="cell"><h3>A</h3>' + next.a + '</section><section class="cell"><h3>B</h3>' + next.b + '</section></div></details>' +
    '<div class="choices"><button class="primary" data-choice="A">A is better</button>' +
    '<button data-choice="tie">About the same</button>' +
    '<button class="primary" data-choice="B">B is better</button></div>';
  document.querySelectorAll("audio").forEach((player) =>
    player.addEventListener("play", () => document.querySelectorAll("audio").forEach((other) => other !== player && other.pause())),
  );
  window.scrollTo(0, 0);
}

async function pick(choice) {
  if (current === null) return;
  const token = current;
  const reason = document.getElementById("reason").value;
  current = null;
  document.querySelectorAll("audio").forEach((player) => player.pause());
  document.querySelectorAll("button").forEach((button) => (button.disabled = true));
  const response = await fetch("/api/pick", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, choice, reason }),
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
load();
</script>
</body></html>
`;
