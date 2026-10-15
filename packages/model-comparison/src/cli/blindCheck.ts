import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { parseArgs } from "node:util";
import { formatTimestamp } from "@overview/domain";
import { blindPageHtml } from "../blindPageHtml.js";
import type { BlindChoice } from "../BlindPick.js";
import { comparisonPaths, loadComparison } from "../comparisonPaths.js";
import { judgmentStore, pickStore } from "../judgmentStore.js";
import { BASELINE_MODEL } from "../judgePair.js";
import { blindPairSet, blindPick, isInSet, nextBlindPair } from "../nextBlindPair.js";
import { escapeHtml, noteHtml } from "../noteHtml.js";
import { judgingPairs, type JudgingPair } from "../runJudging.js";

const { values } = parseArgs({
  options: {
    run: { type: "string" },
    port: { type: "string", default: "4792" },
    candidates: { type: "string" },
    limit: { type: "string" },
  },
});
if (!values.run) {
  console.error(
    "usage: npm run blind --workspace packages/model-comparison -- --run <name> " +
      "[--candidates provider:model,...] [--limit <pairs>] [--port <port>]",
  );
  process.exit(1);
}
const runName = values.run;

const { runs, byVideo } = await loadComparison(runName);
const pairs = blindPairSet(judgingPairs(runs, byVideo, BASELINE_MODEL), {
  candidates: values.candidates?.split(",").map((name) => name.trim()),
  limit: values.limit === undefined ? undefined : Number(values.limit),
});
const picks = pickStore(comparisonPaths.picks(runName));
const judgments = judgmentStore(comparisonPaths.judgments(runName));
const shown = new Map<string, { pair: JudgingPair; candidateWasA: boolean }>();

const send = (response: import("node:http").ServerResponse, status: number, type: string, body: string) => {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  response.end(body);
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/") return send(response, 200, "text/html; charset=utf-8", blindPageHtml());

    if (request.method === "GET" && request.url === "/api/next") {
      const picked = await picks.all();
      const pair = nextBlindPair(pairs, picked, await judgments.all());
      const counts = { picked: picked.filter((pick) => isInSet(pairs, pick)).length, total: pairs.length };
      if (pair === null) return send(response, 200, "application/json", JSON.stringify({ done: true, ...counts }));

      const token = randomUUID();
      const candidateWasA = Math.random() < 0.5;
      shown.set(token, { pair, candidateWasA });
      const [a, b] = candidateWasA ? [pair.candidate, pair.baseline] : [pair.baseline, pair.candidate];
      const { video, transcript } = pair.fetched;
      return send(
        response,
        200,
        "application/json",
        JSON.stringify({
          ...counts,
          token,
          title: escapeHtml(video.title),
          url: escapeHtml(video.url),
          facts: escapeHtml(`${video.channel} · ${formatTimestamp(video.durationMs ?? transcript.at(-1)?.endMs ?? 0)}`),
          a: noteHtml(a.overview),
          b: noteHtml(b.overview),
        }),
      );
    }

    if (request.method === "POST" && request.url === "/api/pick") {
      let body = "";
      for await (const chunk of request) body += chunk;
      const { token, choice } = JSON.parse(body) as { token?: string; choice?: BlindChoice };
      const showing = token === undefined ? undefined : shown.get(token);
      if (showing === undefined || !["A", "B", "tie"].includes(choice ?? "")) {
        return send(response, 400, "text/plain", "unknown pair or choice; reload the page");
      }
      shown.delete(token!);
      await picks.save(blindPick(showing.pair, showing.candidateWasA, choice!, new Date().toISOString()));
      return send(response, 204, "text/plain", "");
    }

    send(response, 404, "text/plain", "not found");
  } catch (error) {
    send(response, 500, "text/plain", error instanceof Error ? error.message : String(error));
  }
});

server.listen(Number(values.port), "127.0.0.1", () => {
  console.error(`Blind check for ${runName}: http://127.0.0.1:${values.port}/  (${pairs.length} pairs; Ctrl-C to stop)`);
  console.error(`Picks are saved as you make them, to ${comparisonPaths.picks(runName)}`);
});
