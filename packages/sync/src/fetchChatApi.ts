import { ChatStreamEvent, ChatUsage } from "@overview/domain";
import { answered, createApiCaller, createApiRequester, refusalOf, sendApiCall, type ApiRequesterOptions } from "./apiRequest.js";
import type { ChatApi, ChatOutcome, ChatProgress } from "./ChatApi.js";
import { SyncTransportError } from "./SyncRequestError.js";

async function* serverSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
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
}

export function createFetchChatApi(options: ApiRequesterOptions): ChatApi {
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
  return {
    usage: () => answered(request("GET", "/chat-usage", ChatUsage)),
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
}
