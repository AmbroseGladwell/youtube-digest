import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  chatRecordId,
  type Chat,
  type ChatAnswerSection,
  type ChatSource,
  type ChatSourceKind,
  type OverviewId,
  type ProjectId,
  type TopicId,
} from "@overview/domain";
import { createFetchChatApi, type ChatApi } from "@overview/sync";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useSync } from "../sync/SyncContext.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { chatKeys } from "./chatKeys.js";
import { chatWaitOf, type ChatWait } from "./util/chatWaitOf.js";
import { withAnswer } from "./util/withAnswer.js";

export interface AskExtras {
  pins: { overviews: OverviewId[]; projects: ProjectId[]; topics: TopicId[] };
  setAside: OverviewId[];
  searchLibrary: boolean;
}

export const NO_EXTRAS: AskExtras = { pins: { overviews: [], projects: [], topics: [] }, setAside: [], searchLibrary: true };

export type AskState =
  | { status: "idle" }
  | {
      status: "answering";
      conversationId: string;
      question: string;
      text: string;
      sources: { pinned: ChatSource[]; found: ChatSource[] } | null;
      sections: ChatAnswerSection[];
    }
  | { status: "stopped"; conversationId: string; question: string; text: string }
  | { status: "failed"; conversationId: string; question: string }
  | { status: "waiting"; conversationId: string; question: string; wait: ChatWait };

export type AskedFrom = "question" | "typed";

const IDLE: AskState = { status: "idle" };

// The stored answer, sync and waits: docs/features/chats.md, "Asking".
export const useAskQuestion = (overviewId: OverviewId, about: ChatSourceKind, api?: ChatApi) => {
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
    async (conversationId: string, question: string, from: AskedFrom, extras: AskExtras = NO_EXTRAS) => {
      const chatApi = api ?? (apiUrl === null ? null : createFetchChatApi({ baseUrl: apiUrl, token: connection.token }));
      if (chatApi === null || inFlight.current !== null) {
        return;
      }
      const controller = new AbortController();
      inFlight.current = controller;
      const chatId = chatRecordId(overviewId, conversationId);
      const known = queryClient.getQueryData<Chat[]>(chatKeys.list(overviewId)) ?? [];
      analytics.reader.chat.asked({
        overviewId,
        from,
        newConversation: !known.some((chat) => chat.id === chatId),
        pinnedOverviews: extras.pins.overviews.length,
        pinnedProjects: extras.pins.projects.length,
        pinnedTopics: extras.pins.topics.length,
        setAside: extras.setAside.length,
        searchLibrary: extras.searchLibrary,
      });
      setState({ status: "answering", conversationId, question, text: "", sources: null, sections: [] });
      try {
        const outcome = await chatApi.ask(
          overviewId,
          { conversationId, text: question, pins: extras.pins, setAside: extras.setAside, searchLibrary: extras.searchLibrary },
          (piece) => setState((current) => (current.status === "answering" ? { ...current, text: current.text + piece } : current)),
          controller.signal,
          (event) =>
            setState((current) => {
              if (current.status !== "answering") {
                return current;
              }
              if (event.type === "sources") {
                analytics.reader.chat.sourcesAdded({ overviewId, pinned: event.pinned.length, found: event.found.length });
                return { ...current, sources: { pinned: event.pinned, found: event.found } };
              }
              if (event.type === "section") {
                return { ...current, sections: [...current.sections, event.section] };
              }
              return current;
            }),
        );
        if (outcome.type === "failed") {
          analytics.reader.chat.answerFailed({ overviewId });
          setState({ status: "failed", conversationId, question });
          return;
        }
        queryClient.setQueryData<Chat[]>(chatKeys.list(overviewId), (current) =>
          withAnswer(current ?? [], { overviewId }, outcome.chatId, outcome.messages),
        );
        void queryClient.invalidateQueries({ queryKey: chatKeys.asked() });
        const answer = outcome.messages.find((message) => message.from === "answer");
        if (answer !== undefined && answer.from === "answer") {
          analytics.reader.chat.answered({
            overviewId,
            about,
            inSource: answer.inSource,
            sourceCitations: answer.citations.filter((citation) => "startMs" in citation || "paragraph" in citation).length,
            overviewCitations: answer.citations.filter((citation) => "part" in citation).length,
            conversationCitations: answer.citations.filter((citation) => "chatId" in citation).length,
            otherOverviewCitations: answer.citations.filter((citation) => "overviewId" in citation).length,
          });
        }
        void queryClient.invalidateQueries({ queryKey: chatKeys.usage(accountId) });
        syncNow();
        setState(IDLE);
      } catch (error) {
        if (controller.signal.aborted) {
          setState((current) =>
            current.status === "answering" ? { status: "stopped", conversationId, question, text: current.text } : current,
          );
          return;
        }
        const wait = chatWaitOf(error);
        if (wait === null) {
          analytics.reader.chat.answerFailed({ overviewId });
          setState({ status: "failed", conversationId, question });
          return;
        }
        if (wait.kind !== "noSource") {
          analytics.reader.chat.waited({ overviewId, about, wait: wait.kind });
        }
        setState({ status: "waiting", conversationId, question, wait });
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
        }
      }
    },
    [api, apiUrl, connection.token, overviewId, about, queryClient, analytics, accountId, syncNow],
  );

  const stop = useCallback(() => inFlight.current?.abort(), []);
  const dismiss = useCallback(() => setState(IDLE), []);

  return { state, ask, stop, dismiss };
};
