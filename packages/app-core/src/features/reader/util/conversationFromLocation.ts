// One of the overview's conversations, when the reader opened it from the Ask drawer (OV-363),
// carried in the link's state as its conversation id.
export const CONVERSATION_STATE = "conversation";

export function conversationFromLocation(state: unknown): string | null {
  if (typeof state !== "object" || state === null) {
    return null;
  }
  const conversation = (state as Record<string, unknown>)[CONVERSATION_STATE];
  return typeof conversation === "string" && conversation !== "" ? conversation : null;
}
