import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatRecordId, type Chat, type OverviewId } from "@overview/domain";
import { createFetchChatApi, type ChatApi } from "@overview/sync";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useSync } from "../sync/SyncContext.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { chatKeys } from "./chatKeys.js";
import { chatWaitOf, type ChatWait } from "./util/chatWaitOf.js";
import { withAnswer } from "./util/withAnswer.js";

export type AskState =
  | { status: "idle" }
  | { status: "answering"; conversationId: string; question: string; text: string }
  | { status: "failed"; conversationId: string; question: string }
  | { status: "waiting"; conversationId: string; question: string; wait: ChatWait };

export type AskedFrom = "question" | "typed";

const IDLE: AskState = { status: "idle" };

// Asks a question about one overview and follows its answer as it streams. The stored answer
// goes into the conversation at once, and sync brings the record down behind it; a wait comes
// back as a state to show, never as a failure (docs/features/chats.md, "Asking").
export function useAskQuestion(overviewId: OverviewId, api?: ChatApi) {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const { syncNow } = useSync();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AskState>(IDLE);
  const inFlight = useRef<AbortController | null>(null);
  const accountId = libraryAccountIdOf(connection);

  useEffect(() => () => inFlight.current?.abort(), []);

  const ask = useCallback(
    async (conversationId: string, question: string, from: AskedFrom) => {
      const chatApi = api ?? (apiUrl === null ? null : createFetchChatApi({ baseUrl: apiUrl, token: connection.token }));
      if (chatApi === null || inFlight.current !== null) return;
      const controller = new AbortController();
      inFlight.current = controller;
      const chatId = chatRecordId(overviewId, conversationId);
      const known = queryClient.getQueryData<Chat[]>(chatKeys.list(overviewId)) ?? [];
      analytics.reader.chat.asked({ overviewId, from, newConversation: !known.some((chat) => chat.id === chatId) });
      setState({ status: "answering", conversationId, question, text: "" });
      try {
        const outcome = await chatApi.ask(
          overviewId,
          { conversationId, text: question },
          (piece) => setState((current) => (current.status === "answering" ? { ...current, text: current.text + piece } : current)),
          controller.signal,
        );
        if (outcome.type === "failed") {
          analytics.reader.chat.answerFailed({ overviewId });
          setState({ status: "failed", conversationId, question });
          return;
        }
        queryClient.setQueryData<Chat[]>(chatKeys.list(overviewId), (current) =>
          withAnswer(current ?? [], overviewId, outcome.chatId, outcome.messages),
        );
        const answer = outcome.messages.find((message) => message.from === "answer");
        if (answer !== undefined && answer.from === "answer") {
          analytics.reader.chat.answered({
            overviewId,
            inSource: answer.inSource,
            sourceCitations: answer.citations.filter((citation) => !("chatId" in citation)).length,
            conversationCitations: answer.citations.filter((citation) => "chatId" in citation).length,
          });
        }
        void queryClient.invalidateQueries({ queryKey: chatKeys.usage(accountId) });
        syncNow();
        setState(IDLE);
      } catch (error) {
        if (controller.signal.aborted) {
          setState(IDLE);
          return;
        }
        const wait = chatWaitOf(error);
        if (wait === null) {
          analytics.reader.chat.answerFailed({ overviewId });
          setState({ status: "failed", conversationId, question });
          return;
        }
        if (wait.kind !== "noSource") analytics.reader.chat.waited({ overviewId, wait: wait.kind });
        setState({ status: "waiting", conversationId, question, wait });
      } finally {
        if (inFlight.current === controller) inFlight.current = null;
      }
    },
    [api, apiUrl, connection.token, overviewId, queryClient, analytics, accountId, syncNow],
  );

  // Stops the answer: the server stops asking too, stores nothing and gives the question back.
  const stop = useCallback(() => inFlight.current?.abort(), []);
  const dismiss = useCallback(() => setState(IDLE), []);

  return { state, ask, stop, dismiss };
}
