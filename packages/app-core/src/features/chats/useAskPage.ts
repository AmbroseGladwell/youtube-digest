import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { chatConversationId, chatOwner, chatRecordId, MAX_CHAT_PINS, type Chat, type OverviewId, type ProjectId } from "@overview/domain";
import type { AskOwner } from "@overview/sync";
import { Routes } from "../../app/Routes.js";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { chatKeys } from "./chatKeys.js";
import { useDeleteChatMutation } from "./mutations/useDeleteChatMutation.js";
import { useAskChatsQuery } from "./queries/askChatsQuery.js";
import { UNDO_DELETE_MS, type PinnedItem } from "./useChatPanel.js";
import { askScopeOf, useAskOver, type AskOverFrom } from "./useAskOver.js";
import { conversationSources } from "./util/conversationSources.js";

const newConversationId = (): string => crypto.randomUUID();

export const askScopeOfChat = (chat: Chat): "library" | "project" => (chatOwner(chat).kind === "project" ? "project" : "library");

// The Ask page (OV-354, page 3): one conversation over the library or a project at a time, named
// in the address so it survives a reload; the drawer's history of every library and project
// conversation, a deleted one undoable for six seconds; and what the next question pins.
export const useAskPage = (projectId: ProjectId | null, chatParam: string | null) => {
  const owner: AskOwner = projectId === null ? { kind: "library" } : { kind: "project", id: projectId };
  const scope = askScopeOf(owner);
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const stored = useAskChatsQuery().data ?? [];
  const asking = useAskOver(owner);
  const deleteChat = useDeleteChatMutation();
  const [fresh, setFresh] = useState<string>(newConversationId);
  const conversationId = chatParam ?? fresh;
  const [deleting, setDeleting] = useState<Chat | null>(null);
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const [removed, setRemoved] = useState<OverviewId[]>([]);
  const field = useRef<HTMLTextAreaElement | null>(null);

  const chats = stored.filter((chat) => chat.id !== deleting?.id);
  const chat = chats.find((each) => each.id === chatRecordId(owner, conversationId)) ?? null;
  const sources = conversationSources(chat);
  const liveSources = sources.live.filter((source) => !removed.includes(source.overviewId));

  const resetNext = () => {
    setPinned([]);
    setRemoved([]);
  };

  const focusField = () => requestAnimationFrame(() => field.current?.focus());

  const goTo = (at: { project: ProjectId | null; chat: string | null }) => {
    resetNext();
    if (at.chat === null) {
      setFresh(newConversationId());
    }
    navigate(Routes.ask(at));
  };

  const ask = (question: string, from: AskOverFrom) => {
    const text = question.trim();
    if (text === "") {
      return;
    }
    if (chatParam === null) {
      navigate(Routes.ask({ project: projectId, chat: conversationId }), { replace: true });
    }
    void asking.ask(conversationId, text, from, {
      pins: {
        overviews: pinned.flatMap((item) => (item.kind === "overview" ? [item.id] : [])),
        projects: pinned.flatMap((item) => (item.kind === "project" ? [item.id] : [])),
      },
      setAside: removed,
    });
    resetNext();
  };

  const pin = (item: PinnedItem) => {
    if (pinned.length + liveSources.length >= MAX_CHAT_PINS || pinned.some((each) => each.id === item.id)) {
      return;
    }
    setPinned((current) => [...current, item]);
    setRemoved((current) => current.filter((id) => id !== item.id));
    analytics.ask.chat.sourcePinned({ scope, kind: item.kind });
  };
  const unpin = (id: string) => {
    setPinned((current) => current.filter((item) => item.id !== id));
    analytics.ask.chat.sourceRemoved({ scope, all: false });
  };
  const removeSource = (id: OverviewId) => {
    setRemoved((current) => (current.includes(id) ? current : [...current, id]));
    analytics.ask.chat.sourceRemoved({ scope, all: false });
  };
  const clearSources = () => {
    setPinned([]);
    setRemoved(sources.live.map((source) => source.overviewId));
    analytics.ask.chat.sourceRemoved({ scope, all: true });
  };

  const commitDelete = useCallback(
    (gone: Chat) => {
      analytics.ask.drawer.conversationDeleted({ scope: askScopeOfChat(gone) });
      deleteChat.mutate({ listKey: chatKeys.asked(), chatId: gone.id });
    },
    [analytics, deleteChat],
  );

  // Leaving the page before Undo's time is up still makes the delete.
  const stillDeleting = useRef<Chat | null>(null);
  const commitLater = useRef(commitDelete);
  stillDeleting.current = deleting;
  commitLater.current = commitDelete;
  useEffect(
    () => () => {
      if (stillDeleting.current !== null) {
        commitLater.current(stillDeleting.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (deleting === null) {
      return;
    }
    const timer = setTimeout(() => {
      commitDelete(deleting);
      setDeleting(null);
    }, UNDO_DELETE_MS);
    return () => clearTimeout(timer);
  }, [deleting, commitDelete]);

  const openConversation = (opened: Chat) => {
    const of = chatOwner(opened);
    analytics.ask.drawer.conversationOpened({ scope: askScopeOfChat(opened) });
    goTo({ project: of.kind === "project" ? (of.id as ProjectId) : null, chat: chatConversationId(opened.id) });
    focusField();
  };

  const newConversation = () => {
    analytics.ask.drawer.newChat();
    goTo({ project: projectId, chat: null });
    focusField();
  };

  const deleteConversation = (gone: Chat) => {
    if (deleting !== null) {
      commitDelete(deleting);
    }
    setDeleting(gone);
    if (gone.id === chat?.id) {
      goTo({ project: projectId, chat: null });
    }
  };

  const undoDelete = () => {
    if (deleting !== null) {
      analytics.ask.drawer.deleteUndone({ scope: askScopeOfChat(deleting) });
    }
    setDeleting(null);
  };

  const stop = () => {
    analytics.ask.chat.stopped({ scope });
    asking.stop();
  };

  return {
    owner,
    scope,
    conversationId,
    chat,
    chats,
    deleting,
    state: asking.state,
    field,
    pinned,
    liveSources,
    pin,
    unpin,
    removeSource,
    clearSources,
    ask,
    openConversation,
    newConversation,
    deleteConversation,
    undoDelete,
    stop,
    dismiss: asking.dismiss,
  };
};
