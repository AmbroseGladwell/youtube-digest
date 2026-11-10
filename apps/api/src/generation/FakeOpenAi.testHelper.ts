import { DEFAULT_SECTIONS_ENABLED, OurKeyGenerationRequest } from "@overview/domain";

export const validAnswer = {
  inOneLine: "A short description.",
  bigPicture: "",
  coreClaim: "The core claim.",
  thin: false,
  keyPoints: [
    { text: "one", startSegmentIndex: -1, endSegmentIndex: -1 },
    { text: "two", startSegmentIndex: -1, endSegmentIndex: -1 },
    { text: "three", startSegmentIndex: -1, endSegmentIndex: -1 },
  ],
  chapters: [{ title: "Hello", summary: "A greeting.", startSegmentIndex: 0 }],
  matchedTopicNames: [],
  suggestedTopic: null,
  tags: ["one-tag", "two-tag", "three-tag"],
  howToApply: { items: ["do this"] },
};

export const generationRequest = (overviewId: string): OurKeyGenerationRequest =>
  OurKeyGenerationRequest.parse({
    overviewId,
    input: {
      video: {
        id: "example0001",
        url: "https://www.youtube.com/watch?v=example0001",
        title: "Example",
        channel: "Example Channel",
        description: null,
        durationMs: null,
        publishedAt: null,
        thumbnailUrl: null,
      },
      transcript: [{ text: "Hello.", startMs: 0, endMs: 1000 }],
      captureReason: null,
      readerContext: null,
      sectionsEnabled: { ...DEFAULT_SECTIONS_ENABLED, verdict: false, selling: false, watchAnyway: false },
      existingTopics: [],
      pastClaims: [],
      existingTags: [],
      tagAliases: {},
    },
  });

export type FakeOpenAiAnswer = { status: number; body: unknown } | "valid" | "invalid";

export interface FakeOpenAi {
  http: typeof fetch;
  answers: FakeOpenAiAnswer[];
  requests: { url: string; authorization: string | null; model: unknown }[];
  kindChecks: number;
  kindCheckAnswer: "default" | { status: number; body: unknown };
}

const USAGE = { prompt_tokens: 1200, completion_tokens: 300, prompt_tokens_details: { cached_tokens: 200, cache_write_tokens: 800 } };
export const KIND_CHECK_USAGE = { prompt_tokens: 400, completion_tokens: 10 };

// OpenAI's chat completions as our key would meet them: a video's kind check is answered
// "default" apart from the queue, and every other call takes the next answer, the last
// one repeating.
export function makeFakeOpenAi(...answers: FakeOpenAiAnswer[]): FakeOpenAi {
  const fake: FakeOpenAi = {
    answers: answers.length === 0 ? ["valid"] : answers,
    requests: [],
    kindChecks: 0,
    kindCheckAnswer: "default",
    http: (async (url: string | URL | Request, init: RequestInit = {}) => {
      const respond = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      if (String(init.body).includes('"noteKind"')) {
        fake.kindChecks++;
        const check = fake.kindCheckAnswer;
        return check === "default"
          ? respond(200, { choices: [{ message: { content: JSON.stringify({ noteKind: check }) } }], usage: KIND_CHECK_USAGE })
          : respond(check.status, check.body);
      }
      const headers = new Headers(init.headers);
      fake.requests.push({
        url: String(url),
        authorization: headers.get("authorization"),
        model: (JSON.parse(String(init.body)) as { model?: unknown }).model,
      });
      const answer = fake.answers.length > 1 ? fake.answers.shift()! : fake.answers[0]!;
      if (answer === "valid" || answer === "invalid") {
        const content = JSON.stringify(answer === "valid" ? validAnswer : { nonsense: true });
        return respond(200, { choices: [{ message: { content } }], usage: USAGE });
      }
      return respond(answer.status, answer.body);
    }) as unknown as typeof fetch,
  };
  return fake;
}
