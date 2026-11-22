import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { formatTimestamp, type Overview } from "@overview/domain";
import type { FetchedTranscript } from "@overview/transcripts";
import { blindListenPageHtml } from "../blindListenPageHtml.js";
import { comparisonPaths } from "../comparisonPaths.js";
import { jsonRecordStore, safePathPart } from "../jsonRecordStore.js";
import type { ListenPick, ListenSide } from "../ListenPick.js";
import { listenMarkdown } from "../listenMarkdown.js";
import { listenPairs, nextListenPair, preferenceOf, type ListenPair } from "../listenPairs.js";
import { escapeHtml, noteHtml } from "../noteHtml.js";
import { renderNarration } from "../renderNarration.js";
import { runDirectoryStore } from "../runDirectoryStore.js";
import { videoLengthMs } from "../summariseRuns.js";

const USAGE = `usage: npm run blind-listen --workspace packages/model-comparison -- \\
  --name <listen> --old <run> --new <run> [--tts http://127.0.0.1:8000] [--port 4793] [--report-only]`;

const { values } = parseArgs({
  options: {
    name: { type: "string" },
    old: { type: "string" },
    new: { type: "string" },
    tts: { type: "string", default: "http://127.0.0.1:8000" },
    port: { type: "string", default: "4793" },
    "report-only": { type: "boolean", default: false },
  },
});
if (!values.name || !values.old || !values.new) {
  console.error(USAGE);
  process.exit(1);
}
const { name, old: oldRun, new: newRun } = values as { name: string; old: string; new: string };
const log = (line: string) => console.error(line);

const directory = comparisonPaths.listen(name);
const audioDirectory = join(directory, "audio");
const reportPath = join(directory, "listen.md");
const picks = jsonRecordStore<ListenPick>(join(directory, "picks"), (pick) => `pairs/${safePathPart(pick.videoId)}.json`);

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

async function loadCoverageVideos(): Promise<FetchedTranscript[]> {
  const files = (await readdir(comparisonPaths.coverageTranscripts).catch(() => [])).filter((file) => file.endsWith(".json"));
  const loaded = await Promise.all(
    files.map(async (file) => JSON.parse(await readFile(join(comparisonPaths.coverageTranscripts, file), "utf-8")) as FetchedTranscript),
  );
  return loaded.sort((left, right) => videoLengthMs(left) - videoLengthMs(right));
}

const videos = await loadCoverageVideos();
const byVideo = new Map(videos.map((fetched) => [fetched.video.id ?? fetched.video.url, fetched]));
const pairs = listenPairs(
  await runDirectoryStore(comparisonPaths.run(oldRun)).all(),
  await runDirectoryStore(comparisonPaths.run(newRun)).all(),
  [...byVideo.keys()],
);

async function writeReport(): Promise<void> {
  const order = pairs.map((pair) => pair.videoId);
  const picked = (await picks.all()).sort((left, right) => order.indexOf(left.videoId) - order.indexOf(right.videoId));
  await mkdir(directory, { recursive: true });
  await writeFile(reportPath, listenMarkdown(picked, name, oldRun, newRun));
  log(`Report written to ${reportPath}`);
}

if (values["report-only"]) {
  await writeReport();
  process.exit(0);
}

type Side = "old" | "new";
const audioPath = (videoId: string, side: Side) => join(audioDirectory, `${safePathPart(videoId)}-${side}.m4a`);
const secondsPath = (videoId: string, side: Side) => join(audioDirectory, `${safePathPart(videoId)}-${side}.json`);

async function narrate(videoId: string, side: Side, overview: Overview): Promise<void> {
  if (await exists(secondsPath(videoId, side))) {
    return;
  }
  const narration = await renderNarration(values.tts!, overview);
  await mkdir(audioDirectory, { recursive: true });
  await writeFile(audioPath(videoId, side), narration.audio);
  await writeFile(secondsPath(videoId, side), `${JSON.stringify({ durationSeconds: narration.durationSeconds })}\n`);
  log(`rendered ${videoId} ${side}: ${formatTimestamp(narration.durationSeconds * 1000)}`);
}

const secondsOf = async (videoId: string, side: Side): Promise<number> =>
  (JSON.parse(await readFile(secondsPath(videoId, side), "utf-8")) as { durationSeconds: number }).durationSeconds;

log(`${pairs.length} pairs in both ${oldRun} and ${newRun}. Rendering what isn't rendered yet, one at a time…`);
for (const pair of pairs) {
  await narrate(pair.videoId, "old", pair.old);
  await narrate(pair.videoId, "new", pair.new);
}

const shown = new Map<string, { pair: ListenPair; newWasA: boolean }>();

const send = (response: ServerResponse, status: number, type: string, body: string | Buffer) => {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  response.end(body);
};

const server = createServer(async (request, response) => {
  try {
    const url = request.url ?? "/";
    if (request.method === "GET" && url === "/") {
      return send(response, 200, "text/html; charset=utf-8", blindListenPageHtml());
    }

    if (request.method === "GET" && url === "/api/next") {
      const picked = await picks.all();
      const pair = nextListenPair(pairs, picked);
      const counts = { picked: picked.filter((pick) => pairs.some((each) => each.videoId === pick.videoId)).length, total: pairs.length };
      if (pair === null) {
        await writeReport();
        return send(response, 200, "application/json", JSON.stringify({ done: true, report: escapeHtml(reportPath), ...counts }));
      }
      const token = randomUUID();
      const newWasA = Math.random() < 0.5;
      shown.set(token, { pair, newWasA });
      const [a, b] = newWasA ? [pair.new, pair.old] : [pair.old, pair.new];
      const { video, transcript } = byVideo.get(pair.videoId)!;
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
          a: noteHtml(a),
          b: noteHtml(b),
        }),
      );
    }

    const audio = url.match(/^\/audio\/([\w-]+)\/(A|B)$/);
    if (request.method === "GET" && audio) {
      const showing = shown.get(audio[1]!);
      if (showing === undefined) {
        return send(response, 404, "text/plain", "unknown pair; reload the page");
      }
      const side: Side = (audio[2] === "A") === showing.newWasA ? "new" : "old";
      return send(response, 200, "audio/mp4", await readFile(audioPath(showing.pair.videoId, side)));
    }

    if (request.method === "POST" && url === "/api/pick") {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
      }
      const { token, choice, reason } = JSON.parse(body) as { token?: string; choice?: ListenSide; reason?: string };
      const showing = token === undefined ? undefined : shown.get(token);
      if (showing === undefined || !["A", "B", "tie"].includes(choice ?? "")) {
        return send(response, 400, "text/plain", "unknown pair or choice; reload the page");
      }
      shown.delete(token!);
      const { pair, newWasA } = showing;
      await picks.save({
        videoId: pair.videoId,
        title: byVideo.get(pair.videoId)!.video.title,
        newWasA,
        side: choice!,
        preferred: preferenceOf(choice!, newWasA),
        reason: (reason ?? "").trim(),
        oldSeconds: await secondsOf(pair.videoId, "old"),
        newSeconds: await secondsOf(pair.videoId, "new"),
        pickedAt: new Date().toISOString(),
      });
      return send(response, 204, "text/plain", "");
    }

    send(response, 404, "text/plain", "not found");
  } catch (error) {
    send(response, 500, "text/plain", error instanceof Error ? error.message : String(error));
  }
});

server.listen(Number(values.port), "127.0.0.1", () => {
  log(`Blind listen ${name}: http://127.0.0.1:${values.port}/  (${pairs.length} pairs; Ctrl-C to stop)`);
  log(`Picks are saved as you make them, under ${join(directory, "picks")}`);
});
