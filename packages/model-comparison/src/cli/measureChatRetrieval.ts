import { CHAT_SOURCES, loadChatSource } from "../chat/chatSources.js";
import { closestPassages } from "../chat/closestPassages.js";
import { embeddingDollars } from "../chat/embedTexts.js";
import { locateQuote } from "../chat/locateQuote.js";
import { everyMomentCovered } from "../chat/momentCovered.js";
import { passageEmbeddings, questionEmbeddings } from "../chat/passageEmbeddings.js";
import { transcriptPassages } from "../chat/transcriptPassages.js";

const WINDOWS_S = [30, 60, 120];
const COUNTS = [3, 5, 8];

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY is not set: run under task secrets:evals");
  process.exit(1);
}

const sources = await Promise.all(CHAT_SOURCES.map(loadChatSource));
const found = new Map<string, number>();
const asked = new Map<string, number>();
const byKind = new Map<string, { found: number; asked: number }>();
const lines: string[] = [];

for (const windowS of WINDOWS_S) {
  let passageTokens = 0;
  let videoMs = 0;
  for (const source of sources) {
    const passages = transcriptPassages(source.fetched.transcript, windowS * 1000);
    const embedded = await passageEmbeddings(apiKey, source.overviewId, windowS * 1000, passages);
    passageTokens += embedded.tokens;
    videoMs += source.fetched.transcript.at(-1)?.endMs ?? 0;
    const queries = await questionEmbeddings(
      apiKey,
      source.overviewId,
      source.questions.questions.map((question) => question.question),
    );
    source.questions.questions.forEach((question, index) => {
      if (question.kind === "notInSource") return;
      const moments = question.quotes.map((quote) => locateQuote(source.fetched.transcript, quote) ?? -1);
      for (const count of COUNTS) {
        const key = `${windowS}s top ${count}`;
        const retrieved = closestPassages(passages, embedded.vectors, queries.vectors[index] ?? [], count);
        const hit = everyMomentCovered(retrieved, moments);
        asked.set(key, (asked.get(key) ?? 0) + 1);
        if (hit) found.set(key, (found.get(key) ?? 0) + 1);
        const kindKey = `${key} ${question.kind}`;
        const tally = byKind.get(kindKey) ?? { found: 0, asked: 0 };
        byKind.set(kindKey, { found: tally.found + (hit ? 1 : 0), asked: tally.asked + 1 });
      }
    });
  }
  const perHour = (passageTokens / videoMs) * 3_600_000;
  lines.push(
    `${windowS}s windows: ${passageTokens} tokens to embed ${(videoMs / 3_600_000).toFixed(2)} h of video, ` +
      `${Math.round(perHour)} tokens/h, $${embeddingDollars(perHour).toFixed(6)}/h`,
  );
}

console.log("| Passages | Every expected moment retrieved | inOverview | transcriptOnly | twoMoments |");
console.log("|---|---|---|---|---|");
for (const windowS of WINDOWS_S) {
  for (const count of COUNTS) {
    const key = `${windowS}s top ${count}`;
    const kind = (name: string) => {
      const tally = byKind.get(`${key} ${name}`);
      return tally === undefined ? "—" : `${tally.found}/${tally.asked}`;
    };
    console.log(
      `| ${key} | ${found.get(key) ?? 0}/${asked.get(key) ?? 0} | ${kind("inOverview")} | ${kind("transcriptOnly")} | ${kind("twoMoments")} |`,
    );
  }
}
console.log("");
for (const line of lines) console.log(line);
