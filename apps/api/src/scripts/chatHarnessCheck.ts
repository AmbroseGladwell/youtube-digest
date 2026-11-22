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

// What it measures and how to run it: docs/features/chats.md, "Measured through the endpoint".

interface Question {
  id: string;
  kind:
    | "inOverview"
    | "transcriptOnly"
    | "twoMoments"
    | "notInSource"
    | "offSubject"
    | "filler"
    | "overviewPart"
    | "aboutReader"
    | "product";
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
  rightOnProduct: boolean | null;
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

const PRODUCT: Question[] = [
  { id: "x1", kind: "product", question: "Can you check the label on the packet I've got at home?", quotes: [], mentions: [] },
  {
    id: "x2",
    kind: "product",
    question: "I found another article that disagrees with this. Can you compare them?",
    quotes: [],
    mentions: [],
  },
  { id: "x3", kind: "product", question: "Is this connected to anything else in my library?", quotes: [], mentions: [] },
  { id: "x4", kind: "product", question: "Is what I told you during onboarding used here?", quotes: [], mentions: [] },
];

const OFFERS_WHAT_CHAT_CANNOT =
  /\b(send|share|upload|attach|snap|take)\b[^.?!]{0,30}\b(photo|picture|image|screenshot|file|link|url)s?\b|\b(I|I'll|I can|let me)\b[^.?!]{0,20}\b(search|browse|look (it|that|them) up|check (online|the web))\b/i;
const OWNED = /\byour (own )?(library|saved|overviews)\b|\byou(['’]ve| have)? saved\b/i;

// x1/x2: no offer chat can't take. x3: names a similar overview as theirs, or none. x4: Settings.
const productRight = (question: Question, answer: string, similarTitles: readonly string[]): boolean => {
  if (question.id === "x1" || question.id === "x2") {
    return !OFFERS_WHAT_CHAT_CANNOT.test(answer);
  }
  if (question.id === "x3") {
    const named = similarTitles.some((title) => normalised(answer).includes(normalised(title).split(" ").slice(0, 4).join(" ")));
    return similarTitles.length === 0 ? !named : named && OWNED.test(answer);
  }
  return answer.includes("Settings") && answer.includes("Personalisation");
};

interface SourceCheck {
  kind: Question["kind"];
  webPage: boolean;
  answerable: boolean;
  citesParts: boolean;
  inSource: boolean;
}

const rightOnSourceOf = ({ kind, webPage, answerable, citesParts, inSource }: SourceCheck): boolean | null => {
  if (kind === "filler" || kind === "overviewPart" || kind === "aboutReader" || kind === "product") {
    return null;
  }
  return webPage ? answerable === citesParts : inSource === answerable;
};

interface MentionCheck {
  question: Question;
  personalised: boolean;
  answerable: boolean;
  text: string;
}

const mentionedOf = ({ question, personalised, answerable, text }: MentionCheck): boolean | null => {
  if (question.id === "r1") {
    return personalised
      ? READER_TERMS.some((term) => text.toLowerCase().includes(term)) && text.includes("Settings")
      : !READER_TERMS.some((term) => text.toLowerCase().includes(term)) && text.includes("Settings");
  }
  return answerable && question.mentions.length > 0
    ? question.mentions.some((term) => text.toLowerCase().includes(term.toLowerCase()))
    : null;
};

const rightOnGeneralOf = (kind: Question["kind"], generalKnowledge: boolean | null): boolean | null => {
  if (kind === "notInSource") {
    return generalKnowledge === true;
  }
  return kind === "offSubject" ? generalKnowledge === false : null;
};

const TOLERANCE_MS = 10_000;
const normalised = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const locateQuote = (segments: readonly TranscriptSegment[], quote: string): number | null => {
  let joined = "";
  const starts: Array<{ offset: number; startMs: number }> = [];
  for (const segment of segments) {
    const text = normalised(segment.text);
    if (text.length === 0) {
      continue;
    }
    if (joined.length > 0) {
      joined += " ";
    }
    starts.push({ offset: joined.length, startMs: segment.startMs });
    joined += text;
  }
  const found = joined.indexOf(normalised(quote));
  if (found === -1) {
    return null;
  }
  return starts.filter((start) => start.offset <= found).at(-1)?.startMs ?? null;
};

const loadSource = async (directory: string): Promise<Source> => {
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
};

// The library has nothing over 89 minutes, so two of its longest are joined end to end.
const longSource = (first: Source, whole: Source): Source => {
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
};

// Every number in a text, as written: an answer's numbers should all be the overview's.
const numbersOf = (text: string): string[] => [...text.matchAll(/\d+(?:[.,/]\d+)?/g)].map(([number]) => number);

const main = async () => {
  const [dataDirectory, outFile, mode, limit] = process.argv.slice(2);
  const longOnly = mode === "long-only";
  const profile = mode === "profile";
  const product = mode === "product";
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
      if (put.statusCode !== 200) {
        throw new Error(`settings: ${put.statusCode} ${put.body}`);
      }
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
    if (posted.statusCode !== 201) {
      throw new Error(`overview: ${posted.statusCode} ${posted.body}`);
    }
    numbersIn.set(overview.id, numbersOf(overviewMarkdown(overview)));
    if (web !== null) {
      return { account, overviewId: overview.id };
    }
    const stored = {
      videoId,
      segments: source.segments,
      generated: false,
      fetchedAt: new Date().toISOString(),
      video: youTubeSource(video),
    };
    const put = await account.inject({ method: "PUT", url: `/api/transcripts/${videoId}`, body: stored });
    if (put.statusCode !== 204) {
      throw new Error(`transcript: ${put.statusCode} ${put.body}`);
    }
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
          rightOnProduct: null,
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
        rightOnSource: rightOnSourceOf({
          kind: question.kind,
          webPage: source.page !== null,
          answerable,
          citesParts: parts.length > 0,
          inSource: answer.inSource,
        }),
        citedRightMoment:
          answerable && moments.length > 0
            ? moments.every(
                (moment) => moment !== null && cited.some((c) => c.startMs - TOLERANCE_MS <= moment && moment <= c.endMs + TOLERANCE_MS),
              )
            : null,
        // "What do you know" names Settings, and the profile when there is one.
        mentioned: mentionedOf({ question, personalised: logged.personalised === true, answerable, text: answer.text }),
        citedRightPart:
          question.parts === undefined
            ? null
            : parts.some((cited) =>
                question.parts!.some(({ part, index }) => cited.part === part && (index === null || cited.index === index)),
              ),
        generalKnowledge,
        // OV-329: a fair question the source misses gets general knowledge; one off its subject is declined.
        rightOnGeneral: rightOnGeneralOf(question.kind, generalKnowledge),
        rightOnProduct:
          question.kind === "product"
            ? productRight(question, answer.text, source.overview.verdict?.similarTo.map(({ title }) => title) ?? [])
            : null,
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

  if (product) {
    for (const repeat of [1, 2]) {
      for (const source of sources) {
        const asked = { ...source, questions: PRODUCT };
        const { account, overviewId } = await withSource(asked);
        await converse(asked, account, overviewId, `product-${repeat}`);
        process.stdout.write(`product ${repeat}: ${source.name} done\n`);
      }
    }
    await writeFile(outFile, JSON.stringify({ ranOn: new Date().toISOString().slice(0, 10), turns }, null, 2));
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
};

await main();
