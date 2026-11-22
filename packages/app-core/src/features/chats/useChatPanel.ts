import { useCallback, useEffect, useRef, useState } from "react";
import { chatRecordId, MAX_CHAT_PINS, type Chat, type ChatSourceKind, type OverviewId, type ProjectId } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { chatKeys } from "./chatKeys.js";
import { useDeleteChatMutation } from "./mutations/useDeleteChatMutation.js";
import { useChatsQuery } from "./queries/chatsQuery.js";
import { useAskQuestion, type AskedFrom, type AskExtras } from "./useAskQuestion.js";
import { conversationSources } from "./util/conversationSources.js";
import { firstQuestionOf, lastActive } from "./util/conversationLine.js";

type OpenedFrom = AskedFrom | "menu" | "conversationsLink" | "receipt" | "askDrawer";

export type ChatView = "conversation" | "list";

// Where a followed citation came from, to go back to it at the citation (design 310x).
export interface CameFrom {
  conversationId: string;
  title: string;
  message: number;
}

export const UNDO_DELETE_MS = 6000;

// Something the reader added with "@" for the next question (OV-354, page 1).
export type PinnedItem =
  | { kind: "overview"; id: OverviewId; title: string }
  | { kind: "project"; id: ProjectId; title: string; count: number };

const newConversationId = (): string => crypto.randomUUID();

// Chat beside an overview's note (designs 310d, 310q–310x): a question or the note's field asks
// in a new conversation when the panel is closed and in the open one when it is; the menu's
// Chat reopens the latest. The list of conversations sits behind the header's count, and a
// conversation deleted there can be undone for six seconds before the delete is made.
export function useChatPanel(overviewId: OverviewId, about: ChatSourceKind) {
  const stored = useChatsQuery(overviewId).data ?? [];
  const asking = useAskQuestion(overviewId, about);
  const deleteChat = useDeleteChatMutation();
  const analytics = useAnalytics();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ChatView>("conversation");
  const [conversationId, setConversationId] = useState<string>(newConversationId);
  const [cameFrom, setCameFrom] = useState<CameFrom | null>(null);
  const [focusedMessage, setFocusedMessage] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Chat | null>(null);
  // What the next question sends besides the conversation's sources (OV-354): new pins, sources
  // the reader removed, and Search my library when they changed it here.
  const [pinned, setPinned] = useState<PinnedItem[]>([]);
  const [removed, setRemoved] = useState<OverviewId[]>([]);
  const [searchChoice, setSearchChoice] = useState<boolean | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const idOf = (chat: Chat) => chat.id.slice(overviewId.length + 1);

  const chats = stored.filter((chat) => chat.id !== deleting?.id);
  const sources = conversationSources(chats.find((chat) => chat.id === chatRecordId(overviewId, conversationId)) ?? null);
  const searchLibrary = searchChoice ?? sources.searchLibrary;
  const resetNext = () => {
    setPinned([]);
    setRemoved([]);
    setSearchChoice(null);
  };
  const extras = (): AskExtras => ({
    pins: {
      overviews: pinned.flatMap((item) => (item.kind === "overview" ? [item.id] : [])),
      projects: pinned.flatMap((item) => (item.kind === "project" ? [item.id] : [])),
    },
    setAside: removed,
    searchLibrary,
  });
  // A source removed only leaves the next question; one pinned again comes back (page 2).
  const pin = (item: PinnedItem) => {
    if (pinned.length + sources.live.length >= MAX_CHAT_PINS || pinned.some((each) => each.id === item.id)) return;
    setPinned((current) => [...current, item]);
    analytics.reader.chat.sourcePinned({ overviewId, kind: item.kind });
    setRemoved((current) => current.filter((id) => id !== item.id));
  };
  const unpin = (id: string) => {
    setPinned((current) => current.filter((item) => item.id !== id));
    analytics.reader.chat.sourceRemoved({ overviewId, all: false });
  };
  const removeSource = (id: OverviewId) => {
    setRemoved((current) => (current.includes(id) ? current : [...current, id]));
    analytics.reader.chat.sourceRemoved({ overviewId, all: false });
  };
  const clearSources = () => {
    analytics.reader.chat.sourceRemoved({ overviewId, all: true });
    setPinned([]);
    setRemoved(sources.live.map((source) => source.overviewId));
  };

  const commitDelete = useCallback(
    (chat: Chat) => {
      analytics.reader.chat.conversationDeleted({ overviewId });
      deleteChat.mutate({ listKey: chatKeys.list(overviewId), chatId: chat.id });
    },
    [analytics, deleteChat, overviewId],
  );

  // Leaving the overview before Undo's time is up still makes the delete.
  const stillDeleting = useRef<Chat | null>(null);
  const commitLater = useRef(commitDelete);
  stillDeleting.current = deleting;
  commitLater.current = commitDelete;
  useEffect(
    () => () => {
      if (stillDeleting.current !== null) commitLater.current(stillDeleting.current);
    },
    [],
  );

  useEffect(() => {
    if (deleting === null) return;
    const timer = setTimeout(() => {
      commitDelete(deleting);
      setDeleting(null);
    }, UNDO_DELETE_MS);
    return () => clearTimeout(timer);
  }, [deleting, commitDelete]);

  const focusField = () => requestAnimationFrame(() => field.current?.focus());

  const show = (from: OpenedFrom) => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
    analytics.reader.chat.opened({ overviewId, from });
  };

  const goTo = (id: string) => {
    setConversationId(id);
    resetNext();
    setView("conversation");
    setCameFrom(null);
    setFocusedMessage(null);
  };

  const ask = (question: string, from: AskedFrom) => {
    if (question === "") return;
    if (open && view === "conversation") {
      void asking.ask(conversationId, question, from, extras());
      resetNext();
      return;
    }
    const fresh = newConversationId();
    goTo(fresh);
    if (!open) show(from);
    focusField();
    void asking.ask(fresh, question, from, extras());
  };

  const openLatest = () => {
    const latest = [...chats].sort((a, b) => lastActive(b).localeCompare(lastActive(a)))[0];
    goTo(latest === undefined ? newConversationId() : idOf(latest));
    show("menu");
    focusField();
  };

  const openList = () => {
    setView("list");
    setCameFrom(null);
    if (!open) show("conversationsLink");
  };

  const openConversation = (chat: Chat) => {
    analytics.reader.chat.conversationOpened({ overviewId });
    goTo(idOf(chat));
    if (!open) show("receipt");
    focusField();
  };

  // Arriving from the Ask drawer with one of this overview's conversations (OV-363).
  const arriveAtConversation = (chat: Chat) => {
    goTo(idOf(chat));
    if (!open) show("askDrawer");
    focusField();
  };

  // The latest conversation a question was asked in, for its receipt under the note (310d).
  const answeredHere = (question: string): { at: string; onOpen: () => void } | null => {
    let found: { at: string; chat: Chat } | null = null;
    for (const chat of chats)
      for (const message of chat.messages)
        if (message.from === "reader" && message.text === question && (found === null || message.at > found.at))
          found = { at: message.at, chat };
    if (found === null) return null;
    const { at, chat } = found;
    return { at, onOpen: () => openConversation(chat) };
  };

  // Following an answer's citation of another conversation: that one opens at the message it
  // cited, with a way back to this one at the citation (design 310x).
  const followConversation = (chatId: string, message: number, from: { title: string; message: number }) => {
    const cited = chats.find((chat) => chat.id === chatId);
    if (cited === undefined) return;
    analytics.reader.chat.citationFollowed({ overviewId, to: "conversation" });
    const back: CameFrom = { conversationId, ...from };
    goTo(idOf(cited));
    setCameFrom(back);
    setFocusedMessage(message);
  };

  const goBack = () => {
    if (cameFrom === null) return;
    const { conversationId: back, message } = cameFrom;
    goTo(back);
    setFocusedMessage(message);
  };

  const close = () => {
    setOpen(false);
    analytics.reader.chat.closed({ overviewId });
    opener.current?.focus({ preventScroll: true });
  };

  const newConversation = () => {
    goTo(newConversationId());
    focusField();
  };

  // Gone from the list at once; the delete is made when Undo's six seconds are up, or at once
  // if another is deleted first (design 310t).
  const deleteConversation = (chat: Chat) => {
    if (deleting !== null) commitDelete(deleting);
    setDeleting(chat);
    if (idOf(chat) === conversationId) setConversationId(newConversationId());
  };

  const undoDelete = () => setDeleting(null);

  const stop = () => {
    analytics.reader.chat.stopped({ overviewId });
    asking.stop();
  };

  const current = chats.find((chat) => idOf(chat) === conversationId);
  const askingHere = asking.state.status !== "idle" && asking.state.conversationId === conversationId ? asking.state.question : null;
  const title = view === "list" ? "Conversations" : current !== undefined ? firstQuestionOf(current) : (askingHere ?? "New conversation");

  // The server keeps no text for this overview: chat hides rather than offering what can't work.
  const noSource = asking.state.status === "waiting" && asking.state.wait.kind === "noSource";

  return {
    open,
    view,
    conversationId,
    title,
    chats,
    deleting,
    cameFrom,
    focusedMessage,
    state: asking.state,
    field,
    pinned,
    liveSources: sources.live.filter((source) => !removed.includes(source.overviewId)),
    searchLibrary,
    pin,
    unpin,
    removeSource,
    clearSources,
    setSearchLibrary: setSearchChoice,
    noSource,
    ask,
    openLatest,
    openList,
    openConversation,
    arriveAtConversation,
    answeredHere,
    followConversation,
    goBack,
    close,
    newConversation,
    deleteConversation,
    undoDelete,
    stop,
  };
}
