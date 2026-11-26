import {
  ChatSpeechEvent,
  ChatStreamEvent,
  ChatUsage,
  SPEECH_WARM_PATH,
  SUGGESTED_QUESTIONS_REFRESH_PATH,
  SuggestedQuestionRefreshResponse,
} from "@overview/domain";
import { answered, createApiCaller, createApiRequester, refusalOf, sendApiCall, type ApiRequesterOptions } from "./apiRequest.js";
import type { ChatApi, ChatOutcome, ChatProgress } from "./ChatApi.js";
import { SyncTransportError } from "./SyncRequestError.js";

const serverSentEvents = async function* (body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const bytes of body as unknown as AsyncIterable<Uint8Array>) {
    buffered += decoder.decode(bytes, { stream: true });
    const blocks = buffered.split("\n\n");
    buffered = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data !== "") {
        yield JSON.parse(data);
      }
    }
  }
};

const ndjsonLines = async function* (body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const decoder = new TextDecoder();
  let buffered = "";
  for await (const bytes of body as unknown as AsyncIterable<Uint8Array>) {
    buffered += decoder.decode(bytes, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines.filter((each) => each.trim() !== "")) {
      yield JSON.parse(line);
    }
  }
  if (buffered.trim() !== "") {
    yield JSON.parse(buffered);
  }
};

export const createFetchChatApi = (options: ApiRequesterOptions): ChatApi => {
  const call = createApiCaller(options);
  const request = createApiRequester(options);
  const streamed = async (
    path: string,
    question: unknown,
    onText: (text: string) => void,
    signal: AbortSignal | undefined,
    onProgress: ((event: ChatProgress) => void) | undefined,
  ): Promise<ChatOutcome> => {
    const prepared = call("POST", path, { body: question, ...(signal === undefined ? {} : { signal }) });
    const response = await sendApiCall(prepared);
    if (!response.ok) {
      throw await refusalOf(response, prepared.requestId);
    }
    if (response.body === null) {
      throw new SyncTransportError("The answer arrived with no body", { requestId: prepared.requestId });
    }
    let outcome: ChatOutcome | null = null;
    try {
      for await (const raw of serverSentEvents(response.body)) {
        const event = ChatStreamEvent.parse(raw);
        if (event.type === "text") {
          onText(event.text);
        } else if (event.type === "answered" || event.type === "failed") {
          outcome = event;
        } else {
          onProgress?.(event);
        }
      }
    } catch (error) {
      if (signal?.aborted === true) {
        throw error;
      }
      throw new SyncTransportError("The answer stopped arriving", { cause: error, requestId: prepared.requestId });
    }
    if (outcome === null) {
      throw new SyncTransportError("The answer ended without settling", { requestId: prepared.requestId });
    }
    return outcome;
  };
  const speak = async (chatId: string, message: number, onEvent: (event: ChatSpeechEvent) => void, signal?: AbortSignal) => {
    const path = `/chat-records/${encodeURIComponent(chatId)}/messages/${message}/speech`;
    const prepared = call("POST", path, signal === undefined ? {} : { signal });
    const response = await sendApiCall(prepared);
    if (!response.ok) {
      throw await refusalOf(response, prepared.requestId);
    }
    if (response.body === null) {
      throw new SyncTransportError("The speech arrived with no body", { requestId: prepared.requestId });
    }
    try {
      for await (const raw of ndjsonLines(response.body)) {
        onEvent(ChatSpeechEvent.parse(raw));
      }
    } catch (error) {
      if (signal?.aborted === true) {
        throw error;
      }
      throw new SyncTransportError("The speech stopped arriving", { cause: error, requestId: prepared.requestId });
    }
  };
  return {
    speak,
    warmSpeech: async () => {
      const response = await sendApiCall(call("POST", SPEECH_WARM_PATH, {}));
      if (response.status === 503) {
        return false;
      }
      if (!response.ok && response.status !== 429) {
        throw new SyncTransportError(`The voice answered ${response.status} to a warm-up`);
      }
      return true;
    },
    usage: () => answered(request("GET", "/chat-usage", ChatUsage)),
    refreshSuggestedQuestions: async (scope) =>
      (await answered(request("POST", SUGGESTED_QUESTIONS_REFRESH_PATH, SuggestedQuestionRefreshResponse, { body: { scope } }))).status,
    ask: (overviewId, question, onText, signal, onProgress) =>
      streamed(`/chats/${encodeURIComponent(overviewId)}/messages`, question, onText, signal, onProgress),
    askOver: (owner, question, onText, signal, onProgress) =>
      streamed(
        owner.kind === "library" ? "/chats/library/messages" : `/chats/projects/${encodeURIComponent(owner.id)}/messages`,
        question,
        onText,
        signal,
        onProgress,
      ),
  };
};
