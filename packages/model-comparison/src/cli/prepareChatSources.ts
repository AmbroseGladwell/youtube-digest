import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { fetchInnerTubeTranscript, withSingleRetry, type FetchedTranscript, type YouTubeFetch } from "@overview/transcripts";
import { CHAT_SOURCES, chatSourceDirectory, videoIdInOverview } from "../chat/chatSources.js";
import { ChatQuestionSet, quotesNeeded } from "../chat/ChatQuestion.js";
import { locateQuote } from "../chat/locateQuote.js";
import { clockOf, passageBlock, transcriptPassages } from "../chat/transcriptPassages.js";

const nodeFetch: YouTubeFetch = async (request) => {
  const response = await fetch(request.url, { method: request.method, headers: request.headers, body: request.body ?? null });
  return { status: response.status, body: await response.text() };
};

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { overview: { type: "string" }, window: { type: "string", default: "60" } },
});
const [command] = positionals;

const fetchTranscripts = async (): Promise<number> => {
  let failures = 0;
  for (const source of CHAT_SOURCES) {
    const directory = chatSourceDirectory(source.overviewId);
    const overviewPath = join(directory, "overview.md");
    if (!(await exists(overviewPath))) {
      console.error(`no overview.md for ${source.overviewId}: save it from get_overview first`);
      failures += 1;
      continue;
    }
    const videoId = videoIdInOverview(await readFile(overviewPath, "utf-8"));
    if (videoId === null) {
      console.error(`no YouTube link in ${overviewPath}`);
      failures += 1;
      continue;
    }
    const transcriptPath = join(directory, "transcript.json");
    if (await exists(transcriptPath)) {
      console.error(`have    ${videoId}  ${source.chosenFor}`);
      continue;
    }
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const fetched = await withSingleRetry(() => fetchInnerTubeTranscript(nodeFetch, videoId, url));
      await writeFile(transcriptPath, `${JSON.stringify(fetched)}\n`);
      const lastMs = fetched.transcript.at(-1)?.endMs ?? 0;
      console.error(`fetched ${videoId}  ${fetched.transcript.length} segments to ${clockOf(lastMs)}: ${fetched.video.title}`);
    } catch (error) {
      failures += 1;
      console.error(`FAILED  ${videoId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return failures;
};

const printPassages = async (overviewId: string, windowMs: number): Promise<number> => {
  const fetched = JSON.parse(await readFile(join(chatSourceDirectory(overviewId), "transcript.json"), "utf-8")) as FetchedTranscript;
  for (const passage of transcriptPassages(fetched.transcript, windowMs)) {
    console.log(passageBlock(passage));
  }
  return 0;
};

const checkQuestions = async (): Promise<number> => {
  let problems = 0;
  for (const source of CHAT_SOURCES) {
    const directory = chatSourceDirectory(source.overviewId);
    const questionsPath = join(directory, "questions.json");
    if (!(await exists(questionsPath))) {
      console.error(`MISSING ${source.overviewId} questions.json`);
      problems += 1;
      continue;
    }
    const set = ChatQuestionSet.parse(JSON.parse(await readFile(questionsPath, "utf-8")));
    const fetched = JSON.parse(await readFile(join(directory, "transcript.json"), "utf-8")) as FetchedTranscript;
    for (const question of set.questions) {
      if (question.quotes.length !== quotesNeeded(question.kind)) {
        console.error(
          `${source.overviewId} ${question.id}: ${question.kind} needs ${quotesNeeded(question.kind)} quotes, has ${question.quotes.length}`,
        );
        problems += 1;
      }
      const found = question.quotes.map((quote) => locateQuote(fetched.transcript, quote));
      found.forEach((startMs, index) => {
        if (startMs === null) {
          console.error(`${source.overviewId} ${question.id}: quote not in transcript: "${question.quotes[index]}"`);
          problems += 1;
        }
      });
      console.error(
        `${source.overviewId.slice(0, 8)} ${question.id} ${question.kind.padEnd(14)} ${found.map((ms) => (ms === null ? "?" : clockOf(ms))).join(", ")}`,
      );
    }
  }
  console.error(problems === 0 ? "every quote found" : `${problems} problem(s)`);
  return problems;
};

const usage = "usage: npm run chat-prepare -- fetch | passages --overview <id> [--window <seconds>] | check";
const outcome =
  command === "fetch"
    ? await fetchTranscripts()
    : command === "passages" && values.overview !== undefined
      ? await printPassages(values.overview, Number(values.window) * 1000)
      : command === "check"
        ? await checkQuestions()
        : (console.error(usage), 1);
process.exit(outcome === 0 ? 0 : 1);
