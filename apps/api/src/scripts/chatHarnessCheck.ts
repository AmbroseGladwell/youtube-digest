import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  overviewMarkdown,
  VideoId,
  youTubeSource,
  type ChatStreamEvent,
  type Overview,
  type OverviewPart,
  type TranscriptSegment,
  type VideoSource,
  type WebSource,
} from "@overview/domain";
import { recordingLogger } from "../logs/recordingLogger.testHelper.js";
import { createTestApp } from "../testing/createTestApp.testHelper.js";
import { makeAccount, type TestAccount } from "../testing/TestAccount.testHelper.js";
import { storedOverview } from "../testing/storedRecords.testHelper.js";
import { overviewFromMarkdown } from "./overviewFromMarkdown.js";

// OV-309's check of the real chat endpoint against OV-267's question set, and a worst case:
// 30-question conversations on a source over two hours with another conversation sent. The
// API runs in process on an in-memory Postgres and asks OpenAI on our key, so every number
// below is the endpoint's own: its prompt, its citations, its log line
// (docs/features/chats.md, "Measured through the endpoint").
//
//   node --env-file=../../.env dist/scripts/chatHarnessCheck.js <OV-267 chat data dir> <out.json> [long-only <questions> | profile]
//
// long-only skips the question set and asks each long conversation only its first few questions:
// enough to see whether a second conversation reads the transcript from the cache.
//
// Since OV-319 each source's overview.md goes in the prompt as its real overview, and
// overview-questions.json, where present, adds questions answered from the overview's own items,
// each scored on whether the answer cites one of the parts it lists.
//
// A source with no transcript.json is a web page (OV-320): an article or a recipe page, answered
// from its overview alone. Every answer is also checked for numbers the overview doesn't hold,
// since amounts are code's job; the long-source part needs two sources with transcripts.
//
// profile (OV-343) asks every source's questions twice, once with nothing known about the reader
// and once with READER's profile, plus two questions about the reader, and stops there. Answers
// are kept side by side for reading; code scores the source rules and the "what do you know" one.

interface Question {
  id: string;
  kind: "inOverview" | "transcriptOnly" | "twoMoments" | "notInSource" | "offSubject" | "filler" | "overviewPart" | "aboutReader";
  question: string;
  quotes: string[];
  mentions: string[];
  parts?: Array<{ part: OverviewPart; index: number | null }>;
}

interface Source {
  name: string;
  // A web page's address and title; null for a video.
  page: { url: string; title: string } | null;
  video: VideoSource;
  segments: TranscriptSegment[];
  overview: Partial<Overview>;
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
  citedRightPart: boolean | null;
  generalKnowledge: boolean | null;
  rightOnGeneral: boolean | null;
  partsCited: string[];
  speaksOfOverview: boolean;
  inventedNumbers: string[];
  answer: string;
  inputTokens: number;
  cachedShare: number | null;
  outputTokens: number;
  costDollars: number;
  otherChatMessages: number;
  personalised: boolean;
  ms: number;
}

// A reader unlike the library's usual one, so a fitted answer is easy to tell from a general one.
const READER = { aboutYou: { who: ["nurse"], time: ["night shifts", "my two kids"], focus: ["sleeping better"] } };
const READER_TERMS = ["nurse", "night shift", "kids", "sleep"];

const ABOUT_READER: Question[] = [
  { id: "r1", kind: "aboutReader", question: "What do you know about me?", quotes: [], mentions: [] },
  { id: "r2", kind: "aboutReader", question: "How could I use this in my own week?", quotes: [], mentions: [] },
];

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
  const read = (file: string) => readFile(join(directory, file), "utf-8").catch(() => null);
  const transcriptText = await read("transcript.json");
  const markdownText = (await read("overview.md")) ?? "";
  const transcript =
    transcriptText === null
      ? { video: storedOverview().source as VideoSource, transcript: [] as TranscriptSegment[] }
      : (JSON.parse(transcriptText) as { video: VideoSource; transcript: TranscriptSegment[] });
  const page =
    transcriptText === null
      ? {
          url: /^https?:\/\/\S+$/m.exec(markdownText)?.[0] ?? "https://pages.example/",
          title: /^# (.*)$/m.exec(markdownText)?.[1] ?? "A page",
        }
      : null;
  const questions = (JSON.parse((await read("questions.json"))!) as { questions: Question[] }).questions;
  const overviewQuestions = await read("overview-questions.json");
  const markdown = await read("overview.md");
  return {
    name: directory.split("/").at(-1)!.slice(0, 8),
    page,
    video: transcript.video,
    segments: transcript.transcript,
    overview: markdown === null ? {} : overviewFromMarkdown(markdown),
    questions: [
      ...questions,
      ...(overviewQuestions === null ? [] : (JSON.parse(overviewQuestions) as { questions: Question[] }).questions),
    ],
  };
}

// Two of the library's longest, end to end: the library has nothing over 89 minutes. Questions
// on both, and code-placed fillers through the whole, to fill a 30-question conversation. The
// first's overview goes in the prompt, so the second's questions about its overview are left out.
function longSource(first: Source, whole: Source): Source {
  const second = { ...whole, questions: whole.questions.filter((question) => question.kind !== "overviewPart") };
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
  return {
    name: `${first.name}+${second.name}`,
    page: null,
    video: { ...first.video, durationMs: endMs },
    segments,
    overview: first.overview,
    questions,
  };
}

// Every number in a text, as written: an answer's numbers should all be the overview's.
const numbersOf = (text: string): string[] => [...text.matchAll(/\d+(?:[.,/]\d+)?/g)].map(([number]) => number);

async function main() {
  const [dataDirectory, outFile, mode, limit] = process.argv.slice(2);
  const longOnly = mode === "long-only";
  const profile = mode === "profile";
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
  const numbersIn = new Map<string, string[]>();

  const withSource = async (source: Source, { reader = false } = {}): Promise<{ account: TestAccount; overviewId: string }> => {
    const account = await makeAccount(testApp);
    await testApp.sql.query("update accounts set plan = 'plus' where id = $1", [account.accountId]);
    if (reader) {
      const put = await account.inject({ method: "PUT", url: "/api/settings", body: { ...READER, updatedAt: new Date().toISOString() } });
      if (put.statusCode !== 200) throw new Error(`settings: ${put.statusCode} ${put.body}`);
    }
    const videoId = VideoId.parse(randomUUID().slice(0, 11));
    const video = { ...source.video, id: videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
    const web: WebSource | null =
      source.page === null
        ? null
        : {
            kind: "web",
            id: randomUUID().replaceAll("-", "") as WebSource["id"],
            url: source.page.url,
            title: source.page.title,
            siteName: null,
            author: null,
            publishedAt: null,
            language: "en",
            imageUrl: null,
            wordCount: 2000,
          };
    const overview = storedOverview({ ...source.overview, source: web ?? youTubeSource(video) });
    const posted = await account.inject({ method: "POST", url: "/api/overviews", body: overview });
    if (posted.statusCode !== 201) throw new Error(`overview: ${posted.statusCode} ${posted.body}`);
    numbersIn.set(overview.id, numbersOf(overviewMarkdown(overview)));
    if (web !== null) return { account, overviewId: overview.id };
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
      const logged = lines.slice(before).find((line) => line.logCode === "api.chat.answered") as
        | Record<string, number | boolean | null>
        | undefined;
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
          citedRightPart: null,
          generalKnowledge: null,
          rightOnGeneral: null,
          partsCited: [],
          speaksOfOverview: false,
          inventedNumbers: [],
          answer: "",
          inputTokens: 0,
          cachedShare: null,
          outputTokens: 0,
          costDollars: 0,
          otherChatMessages: 0,
          personalised: false,
          ms: 0,
        });
        const failed = lines.slice(before).find((line) => line.logCode === "api.chat.failed");
        process.stdout.write(
          `! ${source.name} ${label} ${question.id}: ${response.statusCode} ${String(failed?.reason)} ${String(failed?.status)} ${response.body.slice(0, 120)}\n`,
        );
        continue;
      }
      const answerable = question.kind !== "notInSource" && question.kind !== "offSubject" && question.kind !== "filler";
      const generalKnowledge = typeof logged.generalKnowledge === "boolean" ? logged.generalKnowledge : null;
      const parts = answer.citations.flatMap((citation) => ("part" in citation ? [citation] : []));
      const moments = question.quotes.map((quote) => locateQuote(source.segments, quote));
      const cited = answer.citations.flatMap((citation) => ("startMs" in citation ? [citation] : []));
      turns.push({
        source: source.name,
        conversation: label,
        questionId: question.id,
        kind: question.kind,
        failed: false,
        // A web page has no transcript: a decline is right when it cites nothing at all.
        rightOnSource:
          question.kind === "filler" || question.kind === "overviewPart" || question.kind === "aboutReader"
            ? null
            : source.page !== null
              ? answerable === parts.length > 0
              : answer.inSource === answerable,
        citedRightMoment:
          answerable && moments.length > 0
            ? moments.every(
                (moment) => moment !== null && cited.some((c) => c.startMs - TOLERANCE_MS <= moment && moment <= c.endMs + TOLERANCE_MS),
              )
            : null,
        // With a profile, "what do you know" names it and Settings; with none, it names nothing of it.
        mentioned:
          question.id === "r1"
            ? logged.personalised === true
              ? READER_TERMS.some((term) => answer.text.toLowerCase().includes(term)) && answer.text.includes("Settings")
              : !READER_TERMS.some((term) => answer.text.toLowerCase().includes(term))
            : answerable && question.mentions.length > 0
              ? question.mentions.some((term) => answer.text.toLowerCase().includes(term.toLowerCase()))
              : null,
        citedRightPart:
          question.parts === undefined
            ? null
            : parts.some((cited) =>
                question.parts!.some(({ part, index }) => cited.part === part && (index === null || cited.index === index)),
              ),
        generalKnowledge,
        // OV-329: a fair question the source doesn't answer gets general knowledge; one off its subject is declined.
        rightOnGeneral:
          question.kind === "notInSource" ? generalKnowledge === true : question.kind === "offSubject" ? generalKnowledge === false : null,
        partsCited: parts.map(({ part, index }) => `${part}${index}`),
        // The decline the overview-only prompt asks for names the overview; that isn't a third party.
        speaksOfOverview: /\bthe overview\b(?! of this article doesn[’']t cover)|\b(I|we) (suggest|recommend|think)\b/i.test(answer.text),
        // A number the reader asked about is theirs, not one the answer worked out.
        inventedNumbers: numbersOf(answer.text).filter(
          (number) => !numbersIn.get(overviewId)!.includes(number) && !numbersOf(question.question).includes(number),
        ),
        answer: answer.text,
        inputTokens: Number(logged.inputTokens ?? 0),
        cachedShare: typeof logged.cachedShare === "number" ? logged.cachedShare : null,
        outputTokens: Number(logged.outputTokens ?? 0),
        costDollars: Number(logged.costDollars ?? 0),
        otherChatMessages: Number(logged.otherChatMessages ?? 0),
        personalised: logged.personalised === true,
        ms: Number(logged.ms ?? 0),
      });
    }
  };

  if (profile) {
    for (const source of sources) {
      const asked = { ...source, questions: [...source.questions, ...ABOUT_READER] };
      for (const reader of [false, true]) {
        const { account, overviewId } = await withSource(asked, { reader });
        await converse(asked, account, overviewId, reader ? "with-profile" : "no-profile");
      }
      process.stdout.write(`profile: ${source.name} done\n`);
    }
    await writeFile(outFile, JSON.stringify({ ranOn: new Date().toISOString().slice(0, 10), reader: READER, turns }, null, 2));
    await testApp.close();
    return;
  }

  for (const repeat of longOnly ? [] : [1, 2]) {
    for (const source of sources) {
      const { account, overviewId } = await withSource(source);
      await converse(source, account, overviewId, `set-${repeat}`);
      process.stdout.write(`set ${repeat}: ${source.name} done\n`);
    }
  }

  if (sources.filter(({ segments }) => segments.length > 0).length < 2) {
    await writeFile(outFile, JSON.stringify({ ranOn: new Date().toISOString().slice(0, 10), turns }, null, 2));
    await testApp.close();
    return;
  }
  const byLength = [...sources].sort((left, right) => (right.segments.at(-1)?.endMs ?? 0) - (left.segments.at(-1)?.endMs ?? 0));
  const joined = longSource(byLength[0]!, byLength[1]!);
  const long = longOnly ? { ...joined, questions: joined.questions.slice(0, Number(limit ?? 2)) } : joined;
  const { account, overviewId } = await withSource(long);
  await converse(long, account, overviewId, "long-first");
  await converse(long, account, overviewId, "long-second");
  process.stdout.write(`long source (${Math.round(long.segments.at(-1)!.endMs / 60_000)} min): done\n`);

  await writeFile(outFile, JSON.stringify({ ranOn: new Date().toISOString().slice(0, 10), turns }, null, 2));
  await testApp.close();
}

await main();
