import type { Chat } from "@overview/domain";
import { lastActive } from "./conversationLine.js";

export interface AskHistoryGroup {
  label: string;
  chats: Chat[];
}

const DAY_MS = 86_400_000;

const startOfDay = (when: Date) => new Date(when.getFullYear(), when.getMonth(), when.getDate()).getTime();

// OV-354, page 3: the drawer's history, newest first, grouped Today, Yesterday, Previous 7 days and
// Earlier by when each conversation was last asked in.
export function askHistoryGroups(chats: readonly Chat[], now: Date): AskHistoryGroup[] {
  const today = startOfDay(now);
  const labelOf = (chat: Chat) => {
    const day = startOfDay(new Date(lastActive(chat)));
    if (day >= today) return "Today";
    if (day >= today - DAY_MS) return "Yesterday";
    if (day >= today - 7 * DAY_MS) return "Previous 7 days";
    return "Earlier";
  };
  const groups: AskHistoryGroup[] = [];
  for (const chat of [...chats].sort((a, b) => lastActive(b).localeCompare(lastActive(a)))) {
    const label = labelOf(chat);
    const group = groups.at(-1);
    if (group?.label === label) group.chats.push(chat);
    else groups.push({ label, chats: [chat] });
  }
  return groups;
}
