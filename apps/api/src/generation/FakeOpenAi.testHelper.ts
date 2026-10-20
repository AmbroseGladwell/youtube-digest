import { DEFAULT_SECTIONS_ENABLED, OurKeyGenerationRequest } from "@overview/domain";

export const validAnswer = {
  inOneLine: "A short description.",
  coreClaim: "The core claim.",
  thin: false,
  keyPoints: [
    { text: "one", range: null },
    { text: "two", range: null },
    { text: "three", range: null },
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
}

const USAGE = { prompt_tokens: 1200, completion_tokens: 300, prompt_tokens_details: { cached_tokens: 200 } };

// OpenAI's chat completions as our key would meet them: each call takes the next answer,
// and the last one repeats.
export function makeFakeOpenAi(...answers: FakeOpenAiAnswer[]): FakeOpenAi {
  const fake: FakeOpenAi = {
    answers: answers.length === 0 ? ["valid"] : answers,
    requests: [],
    http: (async (url: string | URL | Request, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      fake.requests.push({
        url: String(url),
        authorization: headers.get("authorization"),
        model: (JSON.parse(String(init.body)) as { model?: unknown }).model,
      });
      const answer = fake.answers.length > 1 ? fake.answers.shift()! : fake.answers[0]!;
      const respond = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      if (answer === "valid" || answer === "invalid") {
        const content = JSON.stringify(answer === "valid" ? validAnswer : { nonsense: true });
        return respond(200, { choices: [{ message: { content } }], usage: USAGE });
      }
      return respond(answer.status, answer.body);
    }) as unknown as typeof fetch,
  };
  return fake;
}
