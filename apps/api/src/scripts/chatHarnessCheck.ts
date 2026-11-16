import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { VideoId, youTubeSource, type ChatStreamEvent, type TranscriptSegment, type VideoSource } from "@overview/domain";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";

// OV-309's check of the real chat endpoint against OV-267's question set, and a worst case:
// 30-question conversations on a source over two hours with another conversation sent. The
// API runs in process on an in-memory Postgres and asks OpenAI on our key, so every number
// below is the endpoint's own: its prompt, its citations, its log line
// (docs/features/chats.md, "Measured through the endpoint").
//
//   node --env-file=../../.env dist/scripts/chatHarnessCheck.js <OV-267 chat data dir> <out.json>

interface Question {
  id: string;
  kind: "inOverview" | "transcriptOnly" | "twoMoments" | "notInSource" | "filler";
  question: string;
  quotes: string[];
  mentions: string[];
}

interface Source {
  name: string;
  video: VideoSource;
  segments: TranscriptSegment[];
  questions: Question[];
}

interface Turn {
  source: string;
  conversation: string;
  questionId: string;
  kind: Question["kind"];
  failed: boolean;
  rightOnSource: boolean | null;
  citedRightMoment: boolean | null;
  mentioned: boolean | null;
  inputTokens: number;
  cachedShare: number | null;
  outputTokens: number;
  costDollars: number;
  otherChatMessages: number;
  ms: number;
}

const TOLERANCE_MS = 10_000;
const normalised = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function locateQuote(segments: readonly TranscriptSegment[], quote: string): number | null {
  let joined = "";
  const starts: Array<{ offset: number; startMs: number }> = [];
  for (const segment of segments) {
    const text = normalised(segment.text);
    if (text.length === 0) continue;
    if (joined.length > 0) joined += " ";
    starts.push({ offset: joined.length, startMs: segment.startMs });
    joined += text;
  }
  const found = joined.indexOf(normalised(quote));
  if (found === -1) return null;
  return starts.filter((start) => start.offset <= found).at(-1)?.startMs ?? null;
}

async function loadSource(directory: string): Promise<Source> {
  const transcript = JSON.parse(await readFile(join(directory, "transcript.json"), "utf-8")) as {
    video: VideoSource;
    transcript: TranscriptSegment[];
  };
  const questions = (JSON.parse(await readFile(join(directory, "questions.json"), "utf-8")) as { questions: Question[] }).questions;
  return { name: directory.split("/").at(-1)!.slice(0, 8), video: transcript.video, segments: transcript.transcript, questions };
}

// Two of the library's longest, end to end: the library has nothing over 89 minutes. Questions
// on both, and code-placed fillers through the whole, to fill a 30-question conversation.
function longSource(first: Source, second: Source): Source {
  const offset = (first.segments.at(-1)?.endMs ?? 0) + 1_000;
  const segments = [
    ...first.segments,
    ...second.segments.map((segment) => ({ ...segment, startMs: segment.startMs + offset, endMs: segment.endMs + offset })),
  ];
  const endMs = segments.at(-1)!.endMs;
  const fillers = Array.from({ length: 30 - first.questions.length - second.questions.length }, (_, index): Question => {
    const minute = Math.floor(((index + 1) * endMs) / (19 * 60_000));
    return { id: `f${index + 1}`, kind: "filler", question: `What is being discussed around minute ${minute}?`, quotes: [], mentions: [] };
  });
  const questions = [...first.questions, ...second.questions.map((question) => ({ ...question, id: `b${question.id}` })), ...fillers];
  return { name: `${first.name}+${second.name}`, video: { ...first.video, durationMs: endMs }, segments, questions };
}

async function main() {
  const [dataDirectory, outFile] = process.argv.slice(2);
  const apiKey = process.env.OPENAI_API_KEY;
  if (dataDirectory === undefined || outFile === undefined || apiKey === undefined) {
    throw new Error("usage: chatHarnessCheck <OV-267 chat data dir> <out.json>, with OPENAI_API_KEY set");
  }
  const { lines, logger } = recordingLogger();
  const testApp = await createTestApp(
    {},
    {
      logger,
      ourKey: {
        apiKey,
        dailyGenerations: 300,
        signedOutDailyGenerations: 50,
        dailyChatMessages: 20_000,
        http: globalThis.fetch.bind(globalThis),
      },
    },
  );
  const sourcesDirectory = join(dataDirectory, "sources");
  const sources = await Promise.all((await readdir(sourcesDirectory)).sort().map((name) => loadSource(join(sourcesDirectory, name))));
  const turns: Turn[] = [];

  const withSource = async (source: Source): Promise<{ account: TestAccount; overviewId: string }> => {
    const account = await makeAccount(testApp);
    await testApp.sql.query("update accounts set plan = 'plus' where id = $1", [account.accountId]);
    const videoId = VideoId.parse(randomUUID().slice(0, 11));
    const video = { ...source.video, id: videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
    const overview = storedOverview({ source: youTubeSource(video) });
    const posted = await account.inject({ method: "POST", url: "/api/overviews", body: overview });
    if (posted.statusCode !== 201) throw new Error(`overview: ${posted.statusCode} ${posted.body}`);
    const stored = {
      videoId,
      segments: source.segments,
      generated: false,
      fetchedAt: new Date().toISOString(),
      video: youTubeSource(video),
    };
    const put = await account.inject({ method: "PUT", url: `/api/transcripts/${videoId}`, body: stored });
    if (put.statusCode !== 204) throw new Error(`transcript: ${put.statusCode} ${put.body}`);
    return { account, overviewId: overview.id };
  };

  const converse = async (source: Source, account: TestAccount, overviewId: string, label: string) => {
    const conversationId = randomUUID();
    for (const question of source.questions) {
      const before = lines.length;
      const response = await account.inject({
        method: "POST",
        url: `/api/chats/${overviewId}/messages`,
        body: { conversationId, text: question.question },
      });
      const events = response.body
        .split("\n\n")
        .filter((block) => block.startsWith("data: "))
        .map((block) => JSON.parse(block.slice(6)) as ChatStreamEvent);
      const done = events.at(-1);
      const logged = lines.slice(before).find((line) => line.logCode === "api.chat.answered") as Record<string, number | null> | undefined;
      const answer = done?.type === "answered" ? done.messages[1] : undefined;
      if (answer === undefined || answer.from !== "answer" || logged === undefined) {
        turns.push({
          source: source.name,
          conversation: label,
          questionId: question.id,
          kind: question.kind,
          failed: true,
          rightOnSource: null,
          citedRightMoment: null,
          mentioned: null,
          inputTokens: 0,
          cachedShare: null,
          outputTokens: 0,
          costDollars: 0,
          otherChatMessages: 0,
          ms: 0,
        });
        process.stdout.write(`! ${source.name} ${label} ${question.id}: ${response.statusCode} ${response.body.slice(0, 200)}\n`);
        continue;
      }
      const answerable = question.kind !== "notInSource" && question.kind !== "filler";
      const moments = question.quotes.map((quote) => locateQuote(source.segments, quote));
      const cited = answer.citations.flatMap((citation) => ("startMs" in citation ? [citation] : []));
      turns.push({
        source: source.name,
        conversation: label,
        questionId: question.id,
        kind: question.kind,
        failed: false,
        rightOnSource: question.kind === "filler" ? null : answer.inSource === answerable,
        citedRightMoment:
          answerable && moments.length > 0
            ? moments.every(
                (moment) => moment !== null && cited.some((c) => c.startMs - TOLERANCE_MS <= moment && moment <= c.endMs + TOLERANCE_MS),
              )
            : null,
        mentioned:
          answerable && question.mentions.length > 0
            ? question.mentions.some((term) => answer.text.toLowerCase().includes(term.toLowerCase()))
            : null,
        inputTokens: Number(logged.inputTokens ?? 0),
        cachedShare: logged.cachedShare ?? null,
        outputTokens: Number(logged.outputTokens ?? 0),
        costDollars: Number(logged.costDollars ?? 0),
        otherChatMessages: Number(logged.otherChatMessages ?? 0),
        ms: Number(logged.ms ?? 0),
      });
    }
  };

  for (const repeat of [1, 2]) {
    for (const source of sources) {
      const { account, overviewId } = await withSource(source);
      await converse(source, account, overviewId, `set-${repeat}`);
      process.stdout.write(`set ${repeat}: ${source.name} done\n`);
    }
  }

  const byLength = [...sources].sort((left, right) => (right.segments.at(-1)?.endMs ?? 0) - (left.segments.at(-1)?.endMs ?? 0));
  const long = longSource(byLength[0]!, byLength[1]!);
  const { account, overviewId } = await withSource(long);
  await converse(long, account, overviewId, "long-first");
  await converse(long, account, overviewId, "long-second");
  process.stdout.write(`long source (${Math.round(long.segments.at(-1)!.endMs / 60_000)} min): done\n`);

  await writeFile(outFile, JSON.stringify({ ranOn: new Date().toISOString().slice(0, 10), turns }, null, 2));
  await testApp.close();
}

await main();
