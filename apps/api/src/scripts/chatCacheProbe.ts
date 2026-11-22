import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { TranscriptSegment } from "@overview/domain";
import { chatSystemPrompt, otherChatsPrompt } from "../chats/chatPrompt.js";
import { otherChatsInPrompt } from "../chats/otherChatsInPrompt.js";
import { streamChatCompletion, type PromptMessage } from "../chats/streamChatCompletion.js";
import { transcriptPassages } from "../chats/transcriptPassages.js";

// OV-313: which prompt shapes read a transcript another request cached. Each probe follows the
// first within seconds, on one prompt_cache_key, and reports what OpenAI says it read and wrote.
//
//   node dist/scripts/chatCacheProbe.js <a sources/<id> dir with transcript.json>

const main = async () => {
  const [directory] = process.argv.slice(2);
  const apiKey = process.env.OPENAI_API_KEY;
  if (directory === undefined || apiKey === undefined) {
    throw new Error("usage: chatCacheProbe <source dir>, with OPENAI_API_KEY set");
  }
  const { transcript } = JSON.parse(await readFile(join(directory, "transcript.json"), "utf-8")) as { transcript: TranscriptSegment[] };
  const nonce = randomUUID();
  const system = chatSystemPrompt("video", `Probe ${nonce}. A conversation about this video.`, transcriptPassages(transcript));
  const at = new Date().toISOString();
  const others = otherChatsPrompt(
    "video",
    otherChatsInPrompt([
      {
        id: "o:c",
        overviewId: randomUUID() as never,
        startedAt: at,
        messages: [
          { from: "reader", text: "What is the main argument?", at },
          { from: "answer", text: "That the system is fragile and needs reform.", at, citations: [], inSource: true },
        ],
      },
    ]),
  )!;
  const probes: Array<[string, PromptMessage[]]> = [
    [
      "A first request: transcript, question",
      [
        { role: "system", content: system },
        { role: "user", content: "Who is speaking?" },
      ],
    ],
    [
      "B transcript, a different question",
      [
        { role: "system", content: system },
        { role: "user", content: "What is said about money?" },
      ],
    ],
    [
      "C transcript, other chats as a second system message, question",
      [
        { role: "system", content: system },
        { role: "system", content: others },
        { role: "user", content: "What is said about risk?" },
      ],
    ],
    [
      "D transcript, other chats inside the question",
      [
        { role: "system", content: system },
        { role: "user", content: `${others}\n\n# Question\n\nWhat is said about time?` },
      ],
    ],
    [
      "E transcript, other chats as an assistant-free user message, then question",
      [
        { role: "system", content: system },
        { role: "user", content: others },
        { role: "user", content: "What is said about people?" },
      ],
    ],
  ];
  for (const [label, messages] of probes) {
    const stream = await streamChatCompletion(
      {
        apiKey,
        http: globalThis.fetch.bind(globalThis),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        retried: () => undefined,
      },
      messages,
      `probe-${nonce}`,
    );
    for await (const _piece of stream.pieces) {
    }
    const usage = stream.usage();
    process.stdout.write(
      `${label}: uncached ${usage?.uncachedInputTokens} read ${usage?.cachedInputTokens} written ${usage?.cacheWriteTokens} out ${usage?.outputTokens}\n`,
    );
  }
};

await main();
