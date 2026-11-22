import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatRecordId, type Chat, type ChatAnswerSection, type ChatSource, type OverviewId } from "@overview/domain";
import { createFetchChatApi, type AskOwner, type ChatApi } from "@overview/sync";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useSync } from "../sync/SyncContext.js";
import { libraryAccountIdOf } from "../sync/types/SyncConnection.js";
import { useKnownApiUrl } from "../sync/useKnownApiUrl.js";
import { useSyncConnection } from "../sync/useSyncConnection.js";
import { chatKeys } from "./chatKeys.js";
import type { AskExtras } from "./useAskQuestion.js";
import { chatWaitOf, type ChatWait } from "./util/chatWaitOf.js";
import { withAnswer } from "./util/withAnswer.js";

export type AskOverFrom = "typed" | "starter";

export interface PickedOverview {
  overviewId: OverviewId;
  title: string;
}

export type AskOverState =
  | { status: "idle" }
  | {
      status: "answering";
      conversationId: string;
      question: string;
      // The picking wait (OV-354, page 3): choosing, then reading what was chosen. Null for a
      // small library or project, which is read whole with no choosing.
      picking: "choosing" | "reading" | null;
      picked: PickedOverview[];
      // How many overviews the plan kept to look across (OV-373); absent before it says.
      looked?: number;
      text: string;
      sources: { pinned: ChatSource[]; found: ChatSource[] } | null;
      sections: ChatAnswerSection[];
    }
  | { status: "stopped"; conversationId: string; question: string; text: string }
  | { status: "failed"; conversationId: string; question: string }
  | { status: "waiting"; conversationId: string; question: string; wait: ChatWait };

const IDLE: AskOverState = { status: "idle" };

export const askScopeOf = (owner: AskOwner): "library" | "project" => owner.kind;

// Asks over the whole library or one project and follows its answer: the choosing, what it chose,
// the intro as it streams and each section once whole. The stored answer goes into the Ask page's
// list at once, and sync brings the record down behind it (docs/features/chats.md, "The Ask page").
export const useAskOver = (owner: AskOwner, api?: ChatApi) => {
  const apiUrl = useKnownApiUrl();
  const { connection } = useSyncConnection();
  const { syncNow } = useSync();
  const analytics = useAnalytics();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AskOverState>(IDLE);
  const inFlight = useRef<AbortController | null>(null);
  const accountId = libraryAccountIdOf(connection);
  const scope = askScopeOf(owner);
  const ownerId = owner.kind === "project" ? owner.id : null;

  useEffect(() => () => inFlight.current?.abort(), []);

  const ask = useCallback(
    async (conversationId: string, question: string, from: AskOverFrom, extras: Omit<AskExtras, "searchLibrary">) => {
      const chatApi = api ?? (apiUrl === null ? null : createFetchChatApi({ baseUrl: apiUrl, token: connection.token }));
      if (chatApi === null || inFlight.current !== null) {
        return;
      }
      const controller = new AbortController();
      inFlight.current = controller;
      const asked: AskOwner = ownerId === null ? { kind: "library" } : { kind: "project", id: ownerId };
      const chatId = chatRecordId(asked, conversationId);
      const known = queryClient.getQueryData<Chat[]>(chatKeys.asked()) ?? [];
      analytics.ask.chat.asked({
        scope,
        from,
        newConversation: !known.some((chat) => chat.id === chatId),
        pinnedOverviews: extras.pins.overviews.length,
        pinnedProjects: extras.pins.projects.length,
        setAside: extras.setAside.length,
      });
      setState({ status: "answering", conversationId, question, picking: null, picked: [], text: "", sources: null, sections: [] });
      try {
        const outcome = await chatApi.askOver(
          asked,
          { conversationId, text: question, pins: extras.pins, setAside: extras.setAside },
          (piece) => setState((current) => (current.status === "answering" ? { ...current, text: current.text + piece } : current)),
          controller.signal,
          (event) =>
            setState((current) => {
              if (current.status !== "answering") {
                return current;
              }
              if (event.type === "picking") {
                return { ...current, picking: "choosing" };
              }
              if (event.type === "picked") {
                analytics.ask.chat.picked({
                  scope,
                  overviews: event.overviews.length,
                  ...(event.looked === undefined ? {} : { lookedAcross: event.looked }),
                });
                return {
                  ...current,
                  picking: "reading",
                  picked: event.overviews,
                  ...(event.looked === undefined ? {} : { looked: event.looked }),
                };
              }
              if (event.type === "sources") {
                return { ...current, sources: { pinned: event.pinned, found: event.found } };
              }
              return { ...current, sections: [...current.sections, event.section] };
            }),
        );
        if (outcome.type === "failed") {
          analytics.ask.chat.answerFailed({ scope });
          setState({ status: "failed", conversationId, question });
          return;
        }
        queryClient.setQueryData<Chat[]>(chatKeys.asked(), (current) =>
          withAnswer(current ?? [], ownerId === null ? {} : { projectId: ownerId }, outcome.chatId, outcome.messages),
        );
        const answer = outcome.messages.find((message) => message.from === "answer");
        if (answer !== undefined && answer.from === "answer") {
          analytics.ask.chat.answered({
            scope,
            sections: answer.sections?.sections.length ?? 0,
            overviewCitations: new Set(answer.citations.flatMap((citation) => ("overviewId" in citation ? [citation.overviewId] : [])))
              .size,
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
        if (wait === null || wait.kind === "noSource") {
          analytics.ask.chat.answerFailed({ scope });
          setState({ status: "failed", conversationId, question });
          return;
        }
        analytics.ask.chat.waited({ scope, wait: wait.kind });
        setState({ status: "waiting", conversationId, question, wait });
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
        }
      }
    },
    [api, apiUrl, connection.token, ownerId, scope, queryClient, analytics, accountId, syncNow],
  );

  const stop = useCallback(() => inFlight.current?.abort(), []);
  const dismiss = useCallback(() => setState(IDLE), []);

  return { state, ask, stop, dismiss };
};
