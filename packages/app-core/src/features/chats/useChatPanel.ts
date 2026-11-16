import { useCallback, useRef, useState } from "react";
import type { Chat, OverviewId } from "@overview/domain";
import { useAnalytics } from "../analytics/AnalyticsContext.js";
import { useChatsQuery } from "./queries/chatsQuery.js";
import { useAskQuestion, type AskedFrom } from "./useAskQuestion.js";

type OpenedFrom = AskedFrom | "menu";

const newConversationId = (): string => crypto.randomUUID();

const lastActive = (chat: Chat) => chat.messages.at(-1)?.at ?? chat.startedAt;

// Chat beside an overview's note (design 310d): a question or the note's field asks in a new
// conversation when the panel is closed and in the open one when it is; the menu's Chat reopens
// the latest. Focus goes to the chat's field as it opens, and back to the opener as it closes.
export function useChatPanel(overviewId: OverviewId) {
  const chats = useChatsQuery(overviewId).data ?? [];
  const asking = useAskQuestion(overviewId);
  const analytics = useAnalytics();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string>(newConversationId);
  const opener = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);

  const focusField = () => requestAnimationFrame(() => field.current?.focus());

  const show = useCallback(
    (from: OpenedFrom) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
      analytics.reader.chat.opened({ overviewId, from });
      focusField();
    },
    [analytics, overviewId],
  );

  const ask = (question: string, from: AskedFrom) => {
    if (question === "") return;
    if (open) {
      void asking.ask(conversationId, question, from);
      return;
    }
    const fresh = newConversationId();
    setConversationId(fresh);
    show(from);
    void asking.ask(fresh, question, from);
  };

  const openLatest = () => {
    const latest = [...chats].sort((a, b) => lastActive(b).localeCompare(lastActive(a)))[0];
    setConversationId(latest === undefined ? newConversationId() : latest.id.slice(overviewId.length + 1));
    show("menu");
  };

  const close = () => {
    setOpen(false);
    analytics.reader.chat.closed({ overviewId });
    opener.current?.focus({ preventScroll: true });
  };

  const newConversation = () => {
    setConversationId(newConversationId());
    focusField();
  };

  const stop = () => {
    analytics.reader.chat.stopped({ overviewId });
    asking.stop();
  };

  // The server keeps no text for this overview: chat hides rather than offering what can't work.
  const noSource = asking.state.status === "waiting" && asking.state.wait.kind === "noSource";

  return { open, conversationId, chats, state: asking.state, field, noSource, ask, openLatest, close, newConversation, stop };
}
